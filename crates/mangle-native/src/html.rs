use crate::js::{CallbackPlan, literal_event};
use crate::{Edit, TransformContext, TransformResult};
use html5gum::emitters::callback::{CallbackEmitter, CallbackEvent};
use html5gum::{Span, Tokenizer};
use napi_derive::napi;

/// Keep the HTML tokenizer's byte spans at the native boundary. MagicString and
/// JavaScript use UTF-16 positions, including for text before an attribute.
pub(crate) fn utf16_positions(source: &str) -> Vec<u32> {
    let mut positions = vec![0; source.len() + 1];
    let mut position = 0;
    for (offset, character) in source.char_indices() {
        positions[offset] = position;
        position += character.len_utf16() as u32;
    }
    positions[source.len()] = position;
    positions
}

pub(crate) fn escape_attribute(value: &str, quote: Option<u8>) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '"' if quote != Some(b'\'') => escaped.push_str("&quot;"),
            '\'' if quote != Some(b'"') => escaped.push_str("&#39;"),
            '<' if quote.is_none() => escaped.push_str("&lt;"),
            '>' if quote.is_none() => escaped.push_str("&gt;"),
            '=' if quote.is_none() => escaped.push_str("&#61;"),
            '`' if quote.is_none() => escaped.push_str("&#96;"),
            character if quote.is_none() && character.is_ascii_whitespace() => {
                escaped.push_str(&format!("&#{};", character as u32));
            }
            character => escaped.push(character),
        }
    }
    escaped
}

pub(crate) fn attribute_value_start(source: &str, name_end: usize) -> Option<(usize, Option<u8>)> {
    let bytes = source.as_bytes();
    let mut index = name_end;
    while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
        index += 1;
    }
    if bytes.get(index) != Some(&b'=') {
        return None;
    }
    index += 1;
    while bytes.get(index).is_some_and(u8::is_ascii_whitespace) {
        index += 1;
    }
    let quote = bytes
        .get(index)
        .copied()
        .filter(|byte| matches!(byte, b'\'' | b'"'));
    Some((index + usize::from(quote.is_some()), quote))
}

pub fn transform(source: &str, context: &TransformContext) -> TransformResult {
    let mut result = TransformResult {
        edits: Vec::new(),
        used: Vec::new(),
        preserved: Vec::new(),
        valid: true,
    };
    if context.replacements.is_empty() {
        return result;
    }

    let positions = utf16_positions(source);
    let mut in_start_tag = false;
    let mut is_class = false;
    let mut value_start = None;
    let mut emitter = CallbackEmitter::new(|event: CallbackEvent<'_>, span: Span<usize>| {
        match event {
            CallbackEvent::OpenStartTag { .. } => in_start_tag = true,
            CallbackEvent::AttributeName { name } => {
                is_class = in_start_tag && name == b"class";
                value_start = if is_class {
                    attribute_value_start(source, span.end)
                } else {
                    None
                };
            }
            CallbackEvent::AttributeValue { value } if is_class => {
                let Ok(value) = std::str::from_utf8(value) else {
                    return None;
                };
                let (content, used) = crate::text::replace_tokens(value, context, false);
                result.used.extend(used);
                if content == value {
                    return None;
                }
                // html5gum's value-start span is one byte late for unquoted
                // values. Derive the opening boundary from its parsed name;
                // the tokenizer remains responsible for the value and its end.
                let Some((start, quote)) = value_start else {
                    result.valid = false;
                    return None;
                };
                if span.end > source.len()
                    || !source.is_char_boundary(start)
                    || !source.is_char_boundary(span.end)
                {
                    result.valid = false;
                    return None;
                }
                return Some(Edit {
                    start: positions[start],
                    end: positions[span.end],
                    content: escape_attribute(&content, quote),
                });
            }
            CallbackEvent::CloseStartTag { .. } | CallbackEvent::EndTag { .. } => {
                in_start_tag = false;
                is_class = false;
            }
            _ => {}
        }
        None
    });
    // Script/style/textarea contents are text, not markup. HTML error recovery
    // is intentional: fragment and template consumers accept tag soup too.
    emitter.naively_switch_states(true);
    let mut edits = Vec::new();
    for token in Tokenizer::new_with_emitter(source, emitter) {
        match token {
            Ok(edit) => edits.push(edit),
            Err(_) => {
                return TransformResult {
                    valid: false,
                    ..result
                };
            }
        }
    }
    result.edits = edits;
    result
}

#[napi]
pub fn plan_html_native(source: String) -> CallbackPlan {
    let mut in_start_tag = false;
    let mut is_class = false;
    let mut value_start = None;
    let mut valid = true;
    let mut emitter = CallbackEmitter::new(|event: CallbackEvent<'_>, span: Span<usize>| {
        match event {
            CallbackEvent::OpenStartTag { .. } => in_start_tag = true,
            CallbackEvent::AttributeName { name } => {
                is_class = in_start_tag && name == b"class";
                value_start = if is_class {
                    attribute_value_start(&source, span.end)
                } else {
                    None
                };
            }
            CallbackEvent::AttributeValue { value } if is_class => {
                let (Some((start, quote)), Ok(value)) = (value_start, std::str::from_utf8(value))
                else {
                    return None;
                };
                if span.end > source.len()
                    || !source.is_char_boundary(start)
                    || !source.is_char_boundary(span.end)
                {
                    valid = false;
                    return None;
                }
                let mode = match quote {
                    Some(b'\'') => "html-single",
                    Some(b'"') => "html-double",
                    _ => "html-unquoted",
                };
                return Some(literal_event(
                    &source,
                    value,
                    start as u32,
                    span.end as u32,
                    mode,
                    false,
                    false,
                ));
            }
            CallbackEvent::CloseStartTag { .. } | CallbackEvent::EndTag { .. } => {
                in_start_tag = false;
                is_class = false;
            }
            _ => {}
        }
        None
    });
    emitter.naively_switch_states(true);
    let mut events = Vec::new();
    for token in Tokenizer::new_with_emitter(source.as_str(), emitter) {
        match token {
            Ok(event) => events.push(event),
            Err(_) => {
                return CallbackPlan {
                    events: Vec::new(),
                    valid: false,
                };
            }
        }
    }
    CallbackPlan {
        events: if valid { events } else { Vec::new() },
        valid,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::{HashMap, HashSet};

    fn rewrite(source: &str) -> String {
        let context = TransformContext {
            replacements: HashMap::from([
                ("text-xl".into(), "tw-a".into()),
                ("hover:bg-red/50".into(), "tw-b".into()),
            ]),
            preserved: HashSet::new(),
        };
        let result = transform(source, &context);
        assert!(result.valid);
        let mut encoded: Vec<u16> = source.encode_utf16().collect();
        for edit in result.edits.iter().rev() {
            encoded.splice(
                edit.start as usize..edit.end as usize,
                edit.content.encode_utf16(),
            );
        }
        String::from_utf16(&encoded).unwrap()
    }

    #[test]
    fn preserves_attribute_delimiters_and_unicode_offsets() {
        assert_eq!(
            rewrite("😀<div CLASS = 'text-xl hover:bg-red/50' title=\"text-xl\"></div>"),
            "😀<div CLASS = 'tw-a tw-b' title=\"text-xl\"></div>"
        );
        assert_eq!(rewrite("<div class=text-xl />"), "<div class=tw-a />");
    }

    #[test]
    fn decodes_entities_without_creating_new_attributes() {
        assert_eq!(
            rewrite("<div class=\"text&#45;xl &quot;safe&quot; &amp;\">"),
            "<div class=\"tw-a &quot;safe&quot; &amp;\">"
        );
        assert_eq!(
            rewrite("<div class=text-xl&#32;other>"),
            "<div class=tw-a&#32;other>"
        );
    }

    #[test]
    fn does_not_rewrite_markup_inside_text_or_comments() {
        let source = "<!-- <div class='text-xl'> --><script>const x = '<div class=\"text-xl\">'</script><style>.x:after{content:'<i class=text-xl>'}</style><textarea><b class=text-xl></textarea><div class='text-xl'>";
        assert_eq!(
            rewrite(source),
            source.replace(
                "</textarea><div class='text-xl'>",
                "</textarea><div class='tw-a'>"
            )
        );
    }
}

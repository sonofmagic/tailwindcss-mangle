use crate::TransformContext;
use napi_derive::napi;
use std::collections::HashSet;

// ECMAScript WhiteSpace + LineTerminator, rather than Rust's broader Unicode set.
pub fn is_js_whitespace(c: char) -> bool {
    matches!(c, '\u{0009}'..='\u{000d}' | ' ' | '\u{00a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}')
}

fn is_valid_selector(s: &str) -> bool {
    s.chars().any(|c| {
        c.is_ascii_alphanumeric() || c == '_' || ('%'..='?').contains(&c) || c >= '\u{00a0}'
    })
}

pub fn split_code(source: &str, split_quote: bool) -> Vec<String> {
    source
        .split(|c| is_js_whitespace(c) || (split_quote && c == '"'))
        .filter(|s| is_valid_selector(s))
        .map(str::to_owned)
        .collect()
}

// Match the public splitCode/makeRegex contract in one pass. A quote is always a
// replacement boundary, but only a splitting boundary when splitQuote is enabled.
pub fn replace_tokens(
    source: &str,
    context: &TransformContext,
    split_quote: bool,
) -> (String, Vec<String>) {
    let candidates = split_code(source, split_quote);
    let selected: HashSet<&str> = candidates
        .iter()
        .map(String::as_str)
        .filter(|s| context.replacements.contains_key(*s))
        .collect();
    let mut used = Vec::new();
    let mut seen = HashSet::new();
    for candidate in candidates.iter() {
        if selected.contains(candidate.as_str()) && seen.insert(candidate.as_str()) {
            used.push(candidate.clone());
        }
    }
    // Preserve the legacy sequential replacement behavior for custom names
    // which themselves contain another selected input token. Ordinary names
    // take the single-pass path below.
    if selected.iter().any(|key| {
        key.contains('"')
            || context.replacements[*key].contains('$')
            || split_code(&context.replacements[*key], true)
                .iter()
                .any(|name| selected.contains(name.as_str()))
    }) {
        let mut output = source.to_owned();
        for candidate in &candidates {
            if let Some(replacement) = context.replacements.get(candidate) {
                output = replace_selected_token(&output, candidate, replacement);
            }
        }
        return (output, used);
    }
    let mut output = String::with_capacity(source.len());
    let mut start = 0;
    for (offset, c) in source
        .char_indices()
        .chain(std::iter::once((source.len(), ' ')))
    {
        if is_js_whitespace(c) || c == '"' {
            let token = &source[start..offset];
            if selected.contains(token) {
                output.push_str(&context.replacements[token]);
            } else {
                output.push_str(token);
            }
            if offset < source.len() {
                output.push(c);
            }
            start = offset + c.len_utf8();
        }
    }
    (output, used)
}

/// JavaScript's String.replace replacement-string contract, for its exact
/// lookbehind/lookahead class regex (which has no capture groups).
pub(crate) fn replace_selected_token(source: &str, candidate: &str, replacement: &str) -> String {
    let mut output = String::with_capacity(source.len());
    let mut copied = 0;
    for (start, matched) in source.match_indices(candidate) {
        let end = start + matched.len();
        let boundary = |value: char| is_js_whitespace(value) || value == '"';
        if !source[..start].chars().next_back().is_none_or(boundary)
            || !source[end..].chars().next().is_none_or(boundary)
        {
            continue;
        }
        output.push_str(&source[copied..start]);
        if replacement.contains('$') {
            let mut chars = replacement.chars().peekable();
            while let Some(character) = chars.next() {
                if character == '$' {
                    let expanded = match chars.peek() {
                        Some('$') => Some("$"),
                        Some('&') => Some(matched),
                        Some('`') => Some(&source[..start]),
                        Some('\'') => Some(&source[end..]),
                        _ => None,
                    };
                    if let Some(expanded) = expanded {
                        output.push_str(expanded);
                        chars.next();
                        continue;
                    }
                }
                output.push(character);
            }
        } else {
            output.push_str(replacement);
        }
        copied = end;
    }
    output.push_str(&source[copied..]);
    output
}

#[napi]
pub fn split_code_native(source: String, split_quote: bool) -> Vec<String> {
    split_code(&source, split_quote)
}

#[napi]
pub fn default_class_name_native(index: f64, prefix: String) -> String {
    let index = index.max(0.0) as u64;
    let mut result = prefix;
    result.push((b'a' + (index % 26) as u8) as char);
    let mut rest = index / 26;
    while rest > 0 {
        rest -= 1;
        result.push((b'a' + (rest % 26) as u8) as char);
        rest /= 26;
    }
    result
}

#[napi]
pub fn strip_escape_sequence_native(value: String) -> String {
    value.replace('\\', "")
}

#[napi]
pub fn default_mangle_class_filter_native(value: String) -> bool {
    !matches!(
        value.as_str(),
        "ease-out" | "ease-linear" | "ease-in" | "ease-in-out"
    ) && (value.contains(':') || value.contains('-'))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn whitespace_and_quote_contract() {
        let context = TransformContext {
            replacements: [("bg-red".into(), "tw-a".into())].into(),
            ..Default::default()
        };
        assert_eq!(
            replace_tokens("class=\"bg-red\"", &context, true).0,
            "class=\"tw-a\""
        );
        assert_eq!(
            replace_tokens("class=\"bg-red\"", &context, false).0,
            "class=\"bg-red\""
        );
        assert_eq!(
            split_code("a\u{0085}b\u{feff}c", true),
            vec!["a\u{0085}b", "c"]
        );
    }
    #[test]
    fn replacement_strings_follow_javascript_without_capture_groups() {
        for (replacement, expected) in [
            ("$&", "before p-1 after"),
            ("$$", "before $ after"),
            ("$`", "before before  after"),
            ("$'", "before  after after"),
            ("$1", "before $1 after"),
            ("$<name>", "before $<name> after"),
        ] {
            let context = TransformContext {
                replacements: [("p-1".into(), replacement.into())].into(),
                ..Default::default()
            };
            assert_eq!(
                replace_tokens("before p-1 after", &context, false).0,
                expected
            );
        }
        assert_eq!(
            replace_selected_token("a\"b other", "a\"b", "replaced"),
            "replaced other"
        );
    }

    #[test]
    fn naming_is_stable() {
        assert_eq!(default_class_name_native(0.0, "tw-".into()), "tw-a");
        assert_eq!(default_class_name_native(26.0, "tw-".into()), "tw-aa");
        assert_eq!(default_class_name_native(702.0, "tw-".into()), "tw-aaa");
    }
}

#[napi]
pub fn escape_js_string_native(value: String) -> String {
    let mut output = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\u{2028}' => output.push_str("\\u2028"),
            '\u{2029}' => output.push_str("\\u2029"),
            '"' | '\'' | '\\' => {
                output.push('\\');
                output.push(c);
            }
            _ => output.push(c),
        }
    }
    output
}

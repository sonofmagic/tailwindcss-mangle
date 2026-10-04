use cssparser::{
    AtRuleParser, CowRcStr, DeclarationParser, ParseError, Parser, ParserState,
    QualifiedRuleParser, RuleBodyItemParser, RuleBodyParser, Token,
};
use html5gum::emitters::callback::{CallbackEmitter, CallbackEvent};
use html5gum::{Span, Tokenizer};
use napi_derive::napi;
use std::collections::HashMap;

#[napi(object)]
#[derive(Clone, Debug)]
pub struct EngineSourceSegment {
    pub content: String,
    pub start: u32,
    pub extension: String,
}

#[napi(object)]
pub struct SfcSourceSegments {
    pub html: Vec<EngineSourceSegment>,
    pub bound: Vec<EngineSourceSegment>,
    pub scripts: Vec<EngineSourceSegment>,
    pub styles: Vec<EngineSourceSegment>,
    pub templates: Vec<EngineSourceSegment>,
}

#[napi]
pub fn find_attribute_value_start_native(source: String, value: String) -> i32 {
    let Some(equal) = source.find('=') else {
        return -1;
    };
    let Some((start, _)) = crate::html::attribute_value_start(&source, equal) else {
        return -1;
    };
    let start = source[start..]
        .find(&value)
        .map_or(start, |offset| start + offset);
    source[..start].encode_utf16().count() as i32
}

#[derive(Default)]
struct HtmlTag {
    name: String,
    lang: String,
    start: usize,
}

#[napi]
pub fn extract_sfc_source_segments_native(source: String) -> SfcSourceSegments {
    let mut result = SfcSourceSegments {
        html: vec![],
        bound: vec![],
        scripts: vec![],
        styles: vec![],
        templates: vec![],
    };
    let positions = crate::html::utf16_positions(&source);
    let mut tag = HtmlTag::default();
    let mut blocks: Vec<HtmlTag> = Vec::new();
    let mut attribute = String::new();
    let mut value_start = None;
    let mut in_start_tag = false;
    let mut emitter = CallbackEmitter::new(|event: CallbackEvent<'_>, span: Span<usize>| {
        match event {
            CallbackEvent::OpenStartTag { name } => {
                in_start_tag = true;
                tag = HtmlTag {
                    name: String::from_utf8_lossy(name).into_owned(),
                    ..Default::default()
                };
            }
            CallbackEvent::AttributeName { .. } if in_start_tag => {
                // The HTML tokenizer lowercases names, while Vue className and
                // hoverClass are deliberately case-sensitive framework APIs.
                attribute = source
                    .get(span.start..span.end)
                    .unwrap_or_default()
                    .to_owned();
                value_start =
                    crate::html::attribute_value_start(&source, span.end).map(|value| value.0);
            }
            CallbackEvent::AttributeValue { value } if in_start_tag => {
                let value = String::from_utf8_lossy(value).into_owned();
                if attribute.eq_ignore_ascii_case("lang") {
                    tag.lang = value.trim().to_lowercase();
                }
                let name = attribute
                    .strip_prefix(':')
                    .or_else(|| attribute.strip_prefix("v-bind:"))
                    .or_else(|| attribute.strip_prefix("bind:"))
                    .unwrap_or(&attribute);
                if !value.is_empty()
                    && matches!(name, "class" | "className" | "hover-class" | "hoverClass")
                    && let Some(start) = value_start
                {
                    let bound = name.len() != attribute.len();
                    let segment = EngineSourceSegment {
                        content: value,
                        start: positions[start],
                        extension: if bound { "js" } else { "html" }.into(),
                    };
                    if bound {
                        result.bound.push(segment);
                    } else {
                        result.html.push(segment);
                    }
                }
            }
            CallbackEvent::CloseStartTag { self_closing } => {
                in_start_tag = false;
                if !self_closing && matches!(tag.name.as_str(), "script" | "style" | "template") {
                    tag.start = span.end;
                    blocks.push(std::mem::take(&mut tag));
                }
            }
            CallbackEvent::EndTag { name } => {
                in_start_tag = false;
                let name = String::from_utf8_lossy(name);
                if let Some(index) = blocks.iter().rposition(|block| block.name == name) {
                    let block = blocks.remove(index);
                    if block.start <= span.start {
                        let segment = EngineSourceSegment {
                            content: source[block.start..span.start].to_owned(),
                            start: positions[block.start],
                            extension: block.lang.clone(),
                        };
                        match block.name.as_str() {
                            "script" => result.scripts.push(segment),
                            "style" => result.styles.push(segment),
                            "template" if !block.lang.is_empty() && block.lang != "html" => {
                                result.templates.push(segment)
                            }
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
        None::<()>
    });
    emitter.naively_switch_states(true);
    for _ in Tokenizer::new_with_emitter(source.as_str(), emitter) {}
    result.scripts.sort_by_key(|segment| segment.start);
    result.styles.sort_by_key(|segment| segment.start);
    result.templates.sort_by_key(|segment| segment.start);
    result
}

#[derive(Debug)]
struct AtRule {
    name: String,
    start: usize,
    params_start: usize,
    params_end: usize,
    end: usize,
    depth: usize,
}

#[derive(Debug)]
struct CssRules<'s> {
    source: &'s str,
    at_rules: Vec<AtRule>,
    selectors: Vec<(usize, usize)>,
    valid: bool,
    depth: usize,
}

impl CssRules<'_> {
    fn body(&mut self, input: &mut Parser<'_>) {
        let mut valid = true;
        for item in RuleBodyParser::new(input, self) {
            valid &= item.is_ok();
        }
        self.valid &= valid;
    }
    fn block(&mut self, input: &mut Parser<'_>) -> usize {
        self.depth += 1;
        self.body(input);
        self.depth -= 1;
        let end = input.position().byte_index();
        if self.source.as_bytes().get(end) == Some(&b'}') {
            end + 1
        } else {
            self.valid = false;
            end
        }
    }
}

fn consume(input: &mut Parser<'_>) -> Result<(), ParseError<()>> {
    while let Ok(token) = input.next_including_whitespace_and_comments() {
        if token.is_parse_error() {
            return Err(ParseError::unexpected_token());
        }
    }
    Ok(())
}

impl<'i> DeclarationParser<'i> for CssRules<'_> {
    type Declaration = ();
    type Error = ();
    fn parse_value(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i>,
        _start: &ParserState,
    ) -> Result<(), ParseError<()>> {
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            if token.is_parse_error()
                || matches!(token, Token::CurlyBracketBlock) && !name.starts_with("--")
            {
                return Err(ParseError::unexpected_token());
            }
        }
        Ok(())
    }
}

impl<'i> AtRuleParser<'i> for CssRules<'_> {
    type Prelude = (String, usize, usize);
    type AtRule = ();
    type Error = ();
    fn parse_prelude(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i>,
    ) -> Result<Self::Prelude, ParseError<()>> {
        let start = input.position().byte_index();
        consume(input)?;
        Ok((name.to_string(), start, input.position().byte_index()))
    }
    fn rule_without_block(
        &mut self,
        (name, params_start, params_end): Self::Prelude,
        start: &ParserState,
    ) -> Result<(), ()> {
        let end = params_end + usize::from(self.source.as_bytes().get(params_end) == Some(&b';'));
        self.at_rules.push(AtRule {
            name,
            start: start.position().byte_index(),
            params_start,
            params_end,
            end,
            depth: self.depth,
        });
        Ok(())
    }
    fn parse_block(
        &mut self,
        (name, params_start, params_end): Self::Prelude,
        start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<(), ParseError<()>> {
        let end = self.block(input);
        self.at_rules.push(AtRule {
            name,
            start: start.position().byte_index(),
            params_start,
            params_end,
            end,
            depth: self.depth,
        });
        Ok(())
    }
}

impl<'i> QualifiedRuleParser<'i> for CssRules<'_> {
    type Prelude = (usize, usize);
    type QualifiedRule = ();
    type Error = ();
    fn parse_prelude(&mut self, input: &mut Parser<'i>) -> Result<Self::Prelude, ParseError<()>> {
        let start = input.position().byte_index();
        consume(input)?;
        let end = input.position().byte_index();
        Ok((start, start + self.source[start..end].trim_end().len()))
    }
    fn parse_block(
        &mut self,
        selector: Self::Prelude,
        _start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<(), ParseError<()>> {
        self.selectors.push(selector);
        self.block(input);
        Ok(())
    }
}

impl<'i> RuleBodyItemParser<'i, (), ()> for CssRules<'_> {
    fn parse_declarations(&self) -> bool {
        true
    }
    fn parse_qualified(&self) -> bool {
        true
    }
}

fn validate_css_tokens(input: &mut Parser<'_>, source: &str) -> Result<(), ParseError<()>> {
    loop {
        let start = input.position().byte_index();
        let Ok(token) = input.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        let end = input.position().byte_index();
        match token {
            Token::Comment(_) if !source[..end].ends_with("*/") => {
                return Err(ParseError::unexpected_token());
            }
            Token::QuotedString(_)
                if end - start < 2 || source.as_bytes()[start] != source.as_bytes()[end - 1] =>
            {
                return Err(ParseError::unexpected_token());
            }
            Token::Function(_)
            | Token::ParenthesisBlock
            | Token::SquareBracketBlock
            | Token::CurlyBracketBlock => {
                let closing = match token {
                    Token::SquareBracketBlock => b']',
                    Token::CurlyBracketBlock => b'}',
                    _ => b')',
                };
                input.parse_nested_block(|nested| {
                    validate_css_tokens(nested, source)?;
                    if source.as_bytes().get(nested.position().byte_index()) != Some(&closing) {
                        return Err(ParseError::unexpected_token());
                    }
                    Ok(())
                })?;
            }
            token if token.is_parse_error() => return Err(ParseError::unexpected_token()),
            _ => {}
        }
    }
    Ok(())
}

fn parse_css(source: &str) -> CssRules<'_> {
    let valid = validate_css_tokens(&mut Parser::new(source), source).is_ok();
    let mut rules = CssRules {
        source,
        at_rules: vec![],
        selectors: vec![],
        valid,
        depth: 0,
    };
    rules.body(&mut Parser::new(source));
    rules.at_rules.sort_by_key(|rule| rule.start);
    rules.selectors.sort_unstable();
    rules
}

#[napi]
pub fn extract_css_apply_segments_native(source: String) -> Vec<EngineSourceSegment> {
    let positions = crate::html::utf16_positions(&source);
    parse_css(&source)
        .at_rules
        .into_iter()
        .filter_map(|rule| {
            if rule.name != "apply" {
                return None;
            }
            let raw = &source[rule.params_start..rule.params_end];
            let params = raw.trim_start();
            if params.is_empty() {
                return None;
            }
            let start = rule.params_start + raw.len() - params.len();
            Some(EngineSourceSegment {
                content: params.to_owned(),
                start: positions[start],
                extension: "html".into(),
            })
        })
        .collect()
}

#[derive(Clone, Debug)]
struct ByteEdit {
    start: usize,
    end: usize,
    content: String,
}

fn apply_edits(source: &str, mut edits: Vec<ByteEdit>) -> String {
    edits.sort_by_key(|edit| (edit.start, std::cmp::Reverse(edit.end)));
    let mut result = String::with_capacity(source.len());
    let mut cursor = 0;
    for edit in edits {
        if edit.start < cursor {
            if edit.content.is_empty() {
                cursor = cursor.max(edit.end);
            }
            continue;
        }
        result.push_str(&source[cursor..edit.start]);
        result.push_str(&edit.content);
        cursor = edit.end;
    }
    result.push_str(&source[cursor..]);
    result
}

#[napi(object)]
pub struct StrippedSourceEntries {
    pub css: String,
    pub changed: bool,
}

#[napi]
pub fn strip_compiled_source_entries_native(source: String) -> StrippedSourceEntries {
    let rules = parse_css(&source);
    if !rules.valid {
        return StrippedSourceEntries {
            css: source,
            changed: false,
        };
    }
    let mut edits = Vec::new();
    let mut leading_removed_to = 0;
    for rule in rules.at_rules {
        if rule.name == "source" {
            let mut start = source[..rule.start]
                .trim_end_matches(char::is_whitespace)
                .len();
            let mut end = rule.end;
            // PostCSS removes leading whitespace from the new first root node.
            // Preserve root trailing whitespace when there is no next node.
            if rule.depth == 0
                && source[leading_removed_to..rule.start].trim().is_empty()
                && !source[end..].trim().is_empty()
            {
                if leading_removed_to == 0 {
                    start = rule.start;
                }
                end += source[end..].len() - source[end..].trim_start().len();
                leading_removed_to = rule.end;
            }
            edits.push(ByteEdit {
                start,
                end,
                content: String::new(),
            });
        } else if rule.name == "import" {
            let params = &source[rule.params_start..rule.params_end];
            let mut input = Parser::new(params);
            loop {
                let start = input.position().byte_index();
                let Ok(token) = input.next_including_whitespace_and_comments().cloned() else {
                    break;
                };
                let is_source = matches!(&token, Token::Function(name) if *name == "source");
                if matches!(
                    token,
                    Token::Function(_)
                        | Token::ParenthesisBlock
                        | Token::SquareBracketBlock
                        | Token::CurlyBracketBlock
                ) {
                    // Consume blocks now: cssparser otherwise advances over
                    // them lazily when the next token is requested.
                    if input.parse_nested_block(consume).is_err() {
                        continue;
                    }
                    if is_source {
                        let end = input.position().byte_index();
                        let start = params[..start].trim_end_matches(char::is_whitespace).len();
                        edits.push(ByteEdit {
                            start: rule.params_start + start,
                            end: rule.params_start + end,
                            content: String::new(),
                        });
                    }
                }
            }
        }
    }
    let changed = !edits.is_empty();
    let mut css = apply_edits(&source, edits);
    if leading_removed_to > 0 && css.trim().is_empty() {
        css = source[source.trim_end().len()..].to_owned();
    }
    StrippedSourceEntries { css, changed }
}

#[napi(object)]
pub struct BareSelectorAlias {
    pub canonical: String,
    pub candidate: String,
}

fn class_spans(
    input: &mut Parser<'_>,
    spans: &mut Vec<(usize, usize, String)>,
) -> Result<(), ParseError<()>> {
    while let Ok(token) = input.next_including_whitespace_and_comments().cloned() {
        match token {
            Token::Delim('.') => {
                let start = input.position().byte_index();
                if let Token::Ident(name) = input.next_including_whitespace_and_comments()?.clone()
                {
                    spans.push((start, input.position().byte_index(), name.to_string()));
                }
            }
            Token::Function(_) | Token::ParenthesisBlock => {
                input.parse_nested_block(|nested| class_spans(nested, spans))?
            }
            // Attribute strings and comments cannot contain class selectors.
            _ => {}
        }
    }
    Ok(())
}

fn replace_selector(selector: &str, aliases: &[(String, Vec<String>)]) -> Vec<String> {
    let mut spans = Vec::new();
    let _ = class_spans(&mut Parser::new(selector), &mut spans);
    let by_name: HashMap<_, _> = aliases
        .iter()
        .enumerate()
        .map(|(index, (name, _))| (name.as_str(), index))
        .collect();
    let mut by_alias = vec![Vec::new(); aliases.len()];
    for (start, end, name) in spans {
        if let Some(index) = by_name.get(name.as_str()) {
            by_alias[*index].push((start, end));
        }
    }
    let mut variants = vec![Vec::new()];
    for ((_, replacements), spans) in aliases.iter().zip(by_alias) {
        if spans.is_empty() {
            continue;
        }
        let mut next = Vec::new();
        for edits in variants {
            for replacement in replacements {
                let mut expanded = edits.clone();
                expanded.extend(spans.iter().map(|(start, end)| ByteEdit {
                    start: *start,
                    end: *end,
                    content: replacement.clone(),
                }));
                next.push(expanded);
            }
        }
        variants = next;
    }
    variants
        .into_iter()
        .map(|edits| apply_edits(selector, edits))
        .collect()
}

fn alias_selector_list(selector: &str, aliases: &[(String, Vec<String>)]) -> String {
    if aliases
        .iter()
        .all(|(_, replacements)| replacements.len() == 1)
    {
        return replace_selector(selector, aliases).remove(0);
    }
    let mut parser = Parser::new(selector);
    let mut parts = Vec::new();
    let mut start = 0;
    // PostCSS chooses the first comma's raw spacing, including commas in
    // selector functions, when assigning an expanded selector list.
    let separator = selector.find(',').map(|comma| {
        let tail = &selector[comma + 1..];
        let whitespace = tail.len() - tail.trim_start().len();
        format!(",{}", &tail[..whitespace])
    });
    loop {
        let position = parser.position().byte_index();
        let Ok(token) = parser.next_including_whitespace_and_comments().cloned() else {
            break;
        };
        if matches!(token, Token::Comma) {
            parts.push(selector[start..position].trim());
            start = parser.position().byte_index();
        } else if matches!(
            token,
            Token::Function(_)
                | Token::ParenthesisBlock
                | Token::SquareBracketBlock
                | Token::CurlyBracketBlock
        ) {
            let _ = parser.parse_nested_block(consume);
        }
    }
    parts.push(selector[start..].trim());
    let mut changed = false;
    let expanded = parts
        .into_iter()
        .flat_map(|part| {
            let variants = replace_selector(part, aliases);
            changed |= variants.len() != 1 || variants[0] != part;
            variants
        })
        .collect::<Vec<_>>();
    if changed {
        expanded.join(separator.as_deref().unwrap_or(", "))
    } else {
        selector.to_owned()
    }
}

#[napi]
pub fn replace_bare_arbitrary_selectors_native(
    source: String,
    values: Vec<BareSelectorAlias>,
) -> napi::Result<String> {
    if values.is_empty() {
        return Ok(source);
    }
    let mut aliases: Vec<(String, Vec<String>)> = Vec::new();
    for value in values {
        let replacement = crate::extraction::escape_css_class_name_native(value.candidate);
        if let Some((_, replacements)) = aliases
            .iter_mut()
            .find(|(canonical, _)| canonical == &value.canonical)
        {
            if !replacements.contains(&replacement) {
                replacements.push(replacement);
            }
        } else {
            aliases.push((value.canonical, vec![replacement]));
        }
    }
    let rules = parse_css(&source);
    if !rules.valid
        && aliases
            .iter()
            .any(|(_, replacements)| replacements.len() > 1)
    {
        return Err(napi::Error::from_reason("Unable to parse CSS selectors."));
    }
    let edits = rules
        .selectors
        .into_iter()
        .filter_map(|(start, end)| {
            let selector = &source[start..end];
            let content = alias_selector_list(selector, &aliases);
            (content != selector).then_some(ByteEdit {
                start,
                end,
                content,
            })
        })
        .collect();
    Ok(apply_edits(&source, edits))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sfc_blocks_ignore_comments_and_preserve_utf16() {
        let source = "😀<!-- <script>'wrong'</script> --><template><i class=\"text-red-500\" :class=\"'font-bold'\" /></template><script data-note='>'>const x = 'flex'</script><style>i{@apply p-4;}</style>";
        let result = extract_sfc_source_segments_native(source.into());
        assert_eq!(result.scripts.len(), 1);
        assert_eq!(result.scripts[0].content, "const x = 'flex'");
        assert_eq!(result.html[0].content, "text-red-500");
        assert_eq!(result.bound[0].content, "'font-bold'");
        assert_eq!(result.styles[0].content, "i{@apply p-4;}");
        assert_eq!(
            result.html[0].start as usize,
            source[..source.find("text-red").unwrap()]
                .encode_utf16()
                .count()
        );
    }
    #[test]
    fn apply_uses_css_syntax() {
        let source = "/* @apply wrong; */ .x { content:'@apply wrong;'; --x: { @apply wrong; }; @apply text-red-500 p-[2px]; a:hover { @apply font-bold; } }";
        let result = extract_css_apply_segments_native(source.into());
        assert_eq!(
            result
                .iter()
                .map(|segment| segment.content.as_str())
                .collect::<Vec<_>>(),
            ["text-red-500 p-[2px]", "font-bold"]
        );
    }
    #[test]
    fn stripping_ignores_strings_and_removes_nested_functions() {
        let source = "@import 'source(fake)' source(fn('x')) layer(a);\n@source './src';\n.a { content:'@source x;'; @source inline('x'); color:red; }";
        let result = strip_compiled_source_entries_native(source.into());
        assert!(result.changed);
        assert_eq!(
            result.css,
            "@import 'source(fake)' layer(a);\n.a { content:'@source x;'; color:red; }"
        );
        assert!(!strip_compiled_source_entries_native("@source x; .broken {".into()).changed);
        assert!(
            !strip_compiled_source_entries_native("@import 'x' source(fn('x');".into()).changed
        );
        assert_eq!(
            strip_compiled_source_entries_native("@source 'a';\n@source 'b';\n.x {}".into()).css,
            ".x {}"
        );
    }
    #[test]
    fn stripping_preserves_first_node_whitespace() {
        for (source, expected) in [
            ("  @source x;\n.x {}", "  .x {}"),
            ("  @source x;\n@source y;\n.x {}", "  .x {}"),
            ("  @source x;\n@source y;\n", "\n"),
        ] {
            assert_eq!(
                strip_compiled_source_entries_native(source.into()).css,
                expected
            );
        }
    }
    #[test]
    fn selector_aliases_only_replace_class_identifiers() {
        let source = ".p-\\[10\\%\\], :is(.p-\\[10\\%\\]) { content: '.p-\\[10\\%\\]'; } [class='.p-\\[10\\%\\]'] {}";
        let result = replace_bare_arbitrary_selectors_native(
            source.into(),
            vec![BareSelectorAlias {
                canonical: "p-[10%]".into(),
                candidate: "p-10%".into(),
            }],
        )
        .unwrap();
        assert_eq!(
            result,
            ".p-10\\%, :is(.p-10\\%) { content: '.p-\\[10\\%\\]'; } [class='.p-\\[10\\%\\]'] {}"
        );
    }
    #[test]
    fn nested_blocks_keep_following_token_boundaries() {
        assert_eq!(
            strip_compiled_source_entries_native(
                "@import 'x' supports(display: grid) source('src');".into()
            )
            .css,
            "@import 'x' supports(display: grid);"
        );
        let result = replace_bare_arbitrary_selectors_native(
            ":is(.unused, .bg-\\[\\#fff\\]),.other {}".into(),
            vec![
                BareSelectorAlias {
                    canonical: "bg-[#fff]".into(),
                    candidate: "bg-#fff".into(),
                },
                BareSelectorAlias {
                    canonical: "bg-[#fff]".into(),
                    candidate: "bg-\\#fff".into(),
                },
            ],
        )
        .unwrap();
        assert_eq!(
            result,
            ":is(.unused, .bg-\\#fff), :is(.unused, .bg-\\\\\\#fff), .other {}"
        );
    }
}

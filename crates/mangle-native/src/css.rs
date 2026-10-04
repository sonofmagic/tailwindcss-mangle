use crate::{Edit, TransformContext, TransformResult};
use cssparser::{
    AtRuleParser, CowRcStr, DeclarationParser, ParseError, Parser, ParserState,
    QualifiedRuleParser, RuleBodyItemParser, RuleBodyParser, StyleSheetParser, Token,
};
use napi_derive::napi;

#[napi(object)]
pub struct SelectorResult {
    pub code: String,
    pub preserve_count: u32,
    pub valid: bool,
}

#[derive(Debug)]
struct ByteEdit {
    start: usize,
    end: usize,
    content: String,
}

fn unescape_simple(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut characters = value.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '\\'
            && characters.peek().is_some_and(|next| {
                !next.is_ascii_hexdigit() && !matches!(next, '\n' | '\r' | '\u{c}')
            })
        {
            output.push(characters.next().unwrap());
        } else {
            output.push(character);
        }
    }
    output
}

fn is_vue_scoped(input: &mut Parser<'_>) -> bool {
    let saved = input.state();
    let scoped = match input.next_including_whitespace_and_comments() {
        Ok(Token::SquareBracketBlock) => input
            .parse_nested_block(|attribute| {
                // A namespaced attribute can have a prefix and a local name.
                // Do not inspect its value, which may itself contain data-v-.
                let mut scoped = false;
                while let Ok(token) = attribute.next() {
                    match token {
                        Token::Ident(name) => scoped |= name.contains("data-v-"),
                        Token::Delim('|') => {}
                        _ => break,
                    }
                }
                while attribute.next_including_whitespace_and_comments().is_ok() {}
                Ok::<_, ParseError<()>>(scoped)
            })
            .unwrap_or(false),
        _ => false,
    };
    input.reset(&saved);
    scoped
}

fn scan_selector<'i>(
    input: &mut Parser<'i>,
    context: &TransformContext,
    ignore_vue_scoped: bool,
    edits: &mut Vec<ByteEdit>,
    preserve_count: &mut u32,
) -> Result<(), ParseError<()>> {
    while let Ok(token) = input.next_including_whitespace_and_comments().cloned() {
        match token {
            Token::Delim('.') => {
                let start = input.position().byte_index();
                let Token::Ident(value) = input.next_including_whitespace_and_comments()?.clone()
                else {
                    return Err(ParseError::unexpected_token());
                };
                let end = input.position().byte_index();
                let (original, replacement) =
                    if let Some(replacement) = context.replacements.get(value.as_ref()) {
                        (value.to_string(), Some(replacement))
                    } else {
                        let original = unescape_simple(value.as_ref());
                        let replacement = context.replacements.get(&original);
                        (original, replacement)
                    };
                if let Some(replacement) = replacement
                    && !replacement.is_empty()
                    && !(ignore_vue_scoped && is_vue_scoped(input))
                {
                    let mut escaped = String::new();
                    cssparser::serialize_identifier(replacement, &mut escaped).unwrap();
                    // The serializer terminates a final numeric escape
                    // with whitespace. At the end of a selector the source
                    // already provides a delimiter, so no terminator is
                    // needed (and keeping it changes existing formatting).
                    if escaped.ends_with(' ') && input.is_exhausted() {
                        escaped.pop();
                    }
                    edits.push(ByteEdit {
                        start,
                        end,
                        content: escaped,
                    });
                    if context.preserved.contains(&original) {
                        *preserve_count += 1;
                    }
                }
            }
            Token::Function(_) | Token::ParenthesisBlock => {
                input.parse_nested_block(|nested| {
                    scan_selector(nested, context, ignore_vue_scoped, edits, preserve_count)
                })?;
            }
            Token::SquareBracketBlock => {
                // Attribute values are not selectors (e.g. [class=".foo"]).
                input.parse_nested_block(|nested| {
                    while nested.next_including_whitespace_and_comments().is_ok() {}
                    Ok::<_, ParseError<()>>(())
                })?;
            }
            token if token.is_parse_error() => return Err(ParseError::unexpected_token()),
            _ => {}
        }
    }
    Ok(())
}

pub fn transform_selector(
    source: &str,
    context: &TransformContext,
    ignore_vue_scoped: bool,
) -> SelectorResult {
    let mut parser = Parser::new(source);
    let mut edits = Vec::new();
    let mut preserve_count = 0;
    let valid = scan_selector(
        &mut parser,
        context,
        ignore_vue_scoped,
        &mut edits,
        &mut preserve_count,
    )
    .is_ok();
    let mut code = source.to_string();
    if valid {
        for edit in edits.into_iter().rev() {
            code.replace_range(edit.start..edit.end, &edit.content);
        }
    }
    SelectorResult {
        code,
        preserve_count,
        valid,
    }
}

#[derive(Debug)]
struct Rule {
    selector_start: usize,
    selector_end: usize,
    end: usize,
    before: String,
    first_in_stylesheet: bool,
}

struct StylesheetParser<'s> {
    source: &'s str,
    rules: Vec<Rule>,
    valid: bool,
    depth: usize,
}

impl StylesheetParser<'_> {
    fn body(&mut self, input: &mut Parser<'_>) {
        self.depth += 1;
        let mut valid = true;
        for item in RuleBodyParser::new(input, self) {
            valid = item.is_ok() && valid;
        }
        self.valid &= valid;
        self.depth -= 1;
    }

    fn block_end(&mut self, input: &Parser<'_>) -> usize {
        let end = input.position().byte_index();
        if self.source.as_bytes().get(end) == Some(&b'}') {
            end + 1
        } else {
            self.valid = false;
            end
        }
    }
}

impl<'i> DeclarationParser<'i> for StylesheetParser<'_> {
    type Declaration = ();
    type Error = ();

    fn parse_value(
        &mut self,
        name: CowRcStr<'i>,
        input: &mut Parser<'i>,
        _start: &ParserState,
    ) -> Result<(), ParseError<()>> {
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            // A tag selector such as `a:hover {}` must be retried as a nested
            // qualified rule. Custom-property values can legitimately use {}.
            if token.is_parse_error()
                || matches!(token, Token::CurlyBracketBlock) && !name.starts_with("--")
            {
                return Err(ParseError::unexpected_token());
            }
        }
        Ok(())
    }
}

impl<'i> AtRuleParser<'i> for StylesheetParser<'_> {
    type Prelude = ();
    type AtRule = ();
    type Error = ();

    fn parse_prelude(
        &mut self,
        _name: CowRcStr<'i>,
        input: &mut Parser<'i>,
    ) -> Result<(), ParseError<()>> {
        while input.next_including_whitespace_and_comments().is_ok() {}
        Ok(())
    }

    fn rule_without_block(&mut self, _prelude: (), _start: &ParserState) -> Result<(), ()> {
        Ok(())
    }

    fn parse_block(
        &mut self,
        _prelude: (),
        _start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<(), ParseError<()>> {
        self.body(input);
        self.block_end(input);
        Ok(())
    }
}

impl<'i> QualifiedRuleParser<'i> for StylesheetParser<'_> {
    type Prelude = (usize, usize);
    type QualifiedRule = ();
    type Error = ();

    fn parse_prelude(&mut self, input: &mut Parser<'i>) -> Result<Self::Prelude, ParseError<()>> {
        let start = input.position().byte_index();
        while input.next_including_whitespace_and_comments().is_ok() {}
        let end = input.position().byte_index();
        let trimmed = self.source[start..end].trim_end_matches(['\t', '\n', '\r', '\u{c}', ' ']);
        Ok((start, start + trimmed.len()))
    }

    fn parse_block(
        &mut self,
        (selector_start, selector_end): Self::Prelude,
        _start: &ParserState,
        input: &mut Parser<'i>,
    ) -> Result<(), ParseError<()>> {
        let before_start = self.source[..selector_start]
            .rfind(|character: char| !character.is_ascii_whitespace())
            .map_or(0, |offset| {
                offset + self.source[offset..].chars().next().unwrap().len_utf8()
            });
        let first_in_stylesheet =
            self.depth == 0 && self.source[..selector_start].trim().is_empty();
        self.body(input);
        let end = self.block_end(input);
        self.rules.push(Rule {
            selector_start,
            selector_end,
            end,
            before: self.source[before_start..selector_start].to_string(),
            first_in_stylesheet,
        });
        Ok(())
    }
}

impl<'i> RuleBodyItemParser<'i, (), ()> for StylesheetParser<'_> {
    fn parse_declarations(&self) -> bool {
        true
    }
    fn parse_qualified(&self) -> bool {
        true
    }
}

pub fn transform(
    source: &str,
    context: &TransformContext,
    ignore_vue_scoped: bool,
) -> TransformResult {
    let mut input = Parser::new(source);
    // CSS Syntax recovers an unterminated final comment, whereas PostCSS's
    // public handler rejects the stylesheet. Inspect top-level comments before
    // StyleSheetParser discards them. Unterminated comments inside a block are
    // already rejected by block_end below.
    while let Ok(token) = input.next_including_whitespace_and_comments().cloned() {
        if matches!(token, Token::Comment(_)) {
            let end = input.position().byte_index();
            if end < 2 || &source.as_bytes()[end - 2..end] != b"*/" {
                return TransformResult {
                    valid: false,
                    ..Default::default()
                };
            }
        }
    }
    let mut input = Parser::new(source);
    let mut parser = StylesheetParser {
        source,
        rules: Vec::new(),
        valid: true,
        depth: 0,
    };
    let mut valid = true;
    for item in StyleSheetParser::new(&mut input, &mut parser) {
        valid = item.is_ok() && valid;
    }
    parser.valid &= valid;
    if !parser.valid {
        return TransformResult {
            valid: false,
            ..Default::default()
        };
    }
    parser.rules.sort_by_key(|rule| rule.selector_start);
    let default_before = parser
        .rules
        .iter()
        .find(|rule| !rule.first_in_stylesheet)
        .map_or("\n", |rule| rule.before.as_str());
    let mut edits = Vec::new();
    for rule in &parser.rules {
        let selector = &source[rule.selector_start..rule.selector_end];
        let transformed = transform_selector(selector, context, ignore_vue_scoped);
        if !transformed.valid {
            return TransformResult {
                valid: false,
                ..Default::default()
            };
        }
        if transformed.code == selector && transformed.preserve_count == 0 {
            continue;
        }
        let mut content = String::new();
        let before = if rule.first_in_stylesheet {
            default_before
        } else {
            &rule.before
        };
        for _ in 0..transformed.preserve_count {
            content.push_str(&source[rule.selector_start..rule.end]);
            content.push_str(before);
        }
        content.push_str(&transformed.code);
        edits.push(ByteEdit {
            start: rule.selector_start,
            end: rule.selector_end,
            content,
        });
    }

    // Convert byte positions in a single pass, avoiding a prefix scan per rule.
    let mut cursor = 0;
    let mut utf16_cursor = 0;
    let edits = edits
        .into_iter()
        .map(|edit| {
            utf16_cursor += source[cursor..edit.start].encode_utf16().count() as u32;
            let start = utf16_cursor;
            utf16_cursor += source[edit.start..edit.end].encode_utf16().count() as u32;
            cursor = edit.end;
            Edit {
                start,
                end: utf16_cursor,
                content: edit.content,
            }
        })
        .collect();
    TransformResult {
        edits,
        ..Default::default()
    }
}

/// Locate actual CSS source-map comments without confusing strings or URLs for
/// annotations. The host adapter loads and composes the referenced third-party map.
#[napi]
pub fn css_source_map_annotations_native(source: String) -> Vec<Edit> {
    fn scan(input: &mut Parser<'_>, spans: &mut Vec<(usize, usize)>) {
        loop {
            let start = input.position().byte_index();
            let Ok(token) = input.next_including_whitespace_and_comments().cloned() else {
                break;
            };
            match token {
                Token::Comment(value) => {
                    let value = value.trim_start_matches([' ', '\t', '\n', '\r', '\u{c}']);
                    if value
                        .strip_prefix(['#', '@'])
                        .is_some_and(|value| value.trim_start().starts_with("sourceMappingURL="))
                    {
                        spans.push((start, input.position().byte_index()));
                    }
                }
                Token::CurlyBracketBlock
                | Token::SquareBracketBlock
                | Token::ParenthesisBlock
                | Token::Function(_) => {
                    let _ = input.parse_nested_block(|nested| {
                        scan(nested, spans);
                        Ok::<_, ParseError<()>>(())
                    });
                }
                _ => {}
            }
        }
    }
    let mut spans = Vec::new();
    scan(&mut Parser::new(&source), &mut spans);
    let positions = crate::html::utf16_positions(&source);
    spans
        .into_iter()
        .map(|(start, end)| Edit {
            start: positions[start],
            end: positions[end],
            content: String::new(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context() -> TransformContext {
        TransformContext {
            replacements: [
                ("text-xl", "tw-a"),
                ("hover:bg-red/50", "tw-b"),
                ("中文", "tw-c"),
                ("1col", "tw-d"),
            ]
            .into_iter()
            .map(|(key, value)| (key.into(), value.into()))
            .collect(),
            preserved: Default::default(),
        }
    }

    fn rewrite(source: &str, context: &TransformContext) -> String {
        let result = transform(source, context, true);
        assert!(result.valid, "invalid transform: {source}");
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
    fn decodes_selector_escapes_and_preserves_declaration_text() {
        let source = r#".hover\:bg-red\/50, .\31 col { content: '.text-xl'; --raw: {.text-xl}; }"#;
        assert_eq!(
            rewrite(source, &context()),
            ".tw-b, .tw-d { content: '.text-xl'; --raw: {.text-xl}; }"
        );
    }

    #[test]
    fn handles_nested_rules_pseudos_and_unicode_positions() {
        let source = "/* 😀 */ @media screen { .中文:is(.text-xl, [class='.text-xl']) { &:hover { color: red } .text-xl {} } }";
        assert_eq!(
            rewrite(source, &context()),
            "/* 😀 */ @media screen { .tw-c:is(.tw-a, [class='.text-xl']) { &:hover { color: red } .tw-a {} } }"
        );
    }

    #[test]
    fn only_skips_immediately_following_vue_attributes() {
        let source = ".text-xl[data-v-abcd], .text-xl [data-v-abcd], .text-xl[x='data-v-abcd'], :is(.text-xl[data-v-abcd]) {}";
        assert_eq!(
            rewrite(source, &context()),
            ".text-xl[data-v-abcd], .tw-a [data-v-abcd], .tw-a[x='data-v-abcd'], :is(.text-xl[data-v-abcd]) {}"
        );
    }

    #[test]
    fn clones_original_rule_for_each_preserved_class_occurrence() {
        let mut context = context();
        context.preserved.insert("text-xl".into());
        assert_eq!(
            rewrite(".text-xl { color: red }", &context),
            ".text-xl { color: red }\n.tw-a { color: red }"
        );
        assert_eq!(
            rewrite("@media x{.text-xl.text-xl{color:red}}", &context),
            "@media x{.text-xl.text-xl{color:red}.text-xl.text-xl{color:red}.tw-a.tw-a{color:red}}"
        );
    }

    #[test]
    fn does_not_return_partial_edits_for_invalid_stylesheets() {
        assert!(!transform(".text-xl { color: red", &context(), true).valid);
        assert!(!transform(".text-xl { color: red } broken", &context(), true).valid);
        assert!(!transform(".text-xl { color: red } /* unfinished", &context(), true).valid);
    }

    #[test]
    fn non_ascii_whitespace_is_part_of_css_identifiers() {
        let context = TransformContext {
            replacements: [("text-xl".into(), "tw-a".into())].into(),
            ..Default::default()
        };
        for suffix in ['\u{a0}', '\u{2000}'] {
            let source = format!(".text-xl{suffix}{{color:red}}");
            let result = transform(&source, &context, true);
            assert!(result.valid);
            assert!(result.edits.is_empty());
        }
    }

    #[test]
    fn source_map_annotations_are_comments_not_strings() {
        let source =
            ".x{content:'/*# sourceMappingURL=not-a-map */'}\n/*# sourceMappingURL=real.map */";
        let edits = css_source_map_annotations_native(source.into());
        assert_eq!(edits.len(), 1);
        assert_eq!(
            &source[edits[0].start as usize..edits[0].end as usize],
            "/*# sourceMappingURL=real.map */"
        );
    }
}

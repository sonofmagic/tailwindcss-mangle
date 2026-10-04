use std::collections::HashSet;

use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_ast_visit::{Visit, walk};
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::{GetSpan, SourceType, Span};

use crate::{Edit, Replacement, TransformContext, TransformResult, text};
use napi_derive::napi;

/// Transform JavaScript, TypeScript and JSX without sending the syntax tree over N-API.
pub fn transform(
    source: &str,
    context: &TransformContext,
    preserve_functions: &[String],
    split_quote: bool,
) -> TransformResult {
    run(source, context, preserve_functions, split_quote, None)
}

fn run(
    source: &str,
    context: &TransformContext,
    preserve_functions: &[String],
    split_quote: bool,
    events: Option<&mut Vec<CallbackEvent>>,
) -> TransformResult {
    if source.len() > u32::MAX as usize {
        return TransformResult {
            valid: false,
            ..Default::default()
        };
    }
    let allocator = Allocator::default();
    let parsed = Parser::new(&allocator, source, SourceType::tsx().with_unambiguous(true))
        .with_options(ParseOptions {
            preserve_parens: false,
            ..Default::default()
        })
        .parse();
    if parsed.panicked || !parsed.diagnostics.is_empty() {
        return TransformResult {
            valid: false,
            ..Default::default()
        };
    }
    // Babel rejects early syntax errors while parsing. Oxc deliberately delegates
    // these checks (duplicate declarations, private names, exports) to semantics.
    let semantics = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    // Oxc skips unresolved-export checks in TypeScript mode, whereas Babel's
    // TypeScript parser still rejects them. Keep this part of the original
    // parse-failure contract while accepting valid type-only exports.
    let unresolved_export = parsed.program.body.iter().any(|statement| {
        let Statement::ExportNamedDeclaration(declaration) = statement else {
            return false;
        };
        declaration.specifiers.iter().any(|specifier| {
            matches!(&specifier.local, ModuleExportName::IdentifierReference(identifier)
                    if semantics.semantic.scoping().get_root_binding(identifier.name).is_none())
        })
    });
    if !semantics.diagnostics.is_empty() || unresolved_export {
        return TransformResult {
            valid: false,
            ..Default::default()
        };
    }

    let mut visitor = Transformer {
        source,
        context,
        events,
        preserve_functions,
        split_quote,
        comments: &parsed.program.comments,
        ancestors: Vec::new(),
        ignored_templates: HashSet::new(),
        preserved_seen: HashSet::new(),
        result: TransformResult::default(),
    };
    visitor.visit_program(&parsed.program);
    // Oxc spans are byte offsets; consumers (including MagicString) use UTF-16.
    // Sorting permits a single forward pass instead of rescanning source for every edit.
    visitor.result.edits.sort_by_key(|edit| edit.start);
    let mut byte_offset = 0;
    let mut utf16_offset = 0;
    for edit in &mut visitor.result.edits {
        let start = edit.start as usize;
        let end = edit.end as usize;
        utf16_offset += source[byte_offset..start].encode_utf16().count() as u32;
        edit.start = utf16_offset;
        utf16_offset += source[start..end].encode_utf16().count() as u32;
        edit.end = utf16_offset;
        byte_offset = end;
    }
    visitor.result
}

struct Transformer<'s, 'a> {
    source: &'s str,
    context: &'s TransformContext,
    preserve_functions: &'s [String],
    split_quote: bool,
    comments: &'s [Comment],
    ancestors: Vec<AstKind<'a>>,
    ignored_templates: HashSet<u32>,
    preserved_seen: HashSet<String>,
    result: TransformResult,
    events: Option<&'s mut Vec<CallbackEvent>>,
}

impl Transformer<'_, '_> {
    fn preserve(&mut self, value: String) {
        if !self.context.preserved.contains(&value) && self.preserved_seen.insert(value.clone()) {
            self.result.preserved.push(value);
        }
    }

    fn ignored_string(&self, span: Span) -> bool {
        // Babel attaches a leading comment to the outermost node with this start
        // (for example an object property key or a string literal type), rather
        // than to its nested StringLiteral.
        if self
            .ancestors
            .iter()
            .any(|parent| parent.span().start == span.start)
        {
            return false;
        }
        let mut boundary = span.start as usize;
        let end = self
            .comments
            .partition_point(|comment| comment.span.end <= span.start);
        for comment in self.comments[..end].iter().rev() {
            let between = &self.source[comment.span.end as usize..boundary];
            if !between
                .chars()
                .all(|ch| text::is_js_whitespace(ch) || ch == '(')
            {
                break;
            }
            if self.ancestors.iter().any(|parent| {
                let parent_start = parent.span().start;
                parent_start >= comment.span.end
                    && parent_start < span.start
                    && self.source[parent_start as usize..span.start as usize]
                        .chars()
                        .all(|ch| text::is_js_whitespace(ch) || ch == '(')
            }) {
                break;
            }
            let content = &self.source
                [comment.content_span().start as usize..comment.content_span().end as usize];
            if content.contains("tw-mangle") && content.contains("ignore") {
                return true;
            }
            boundary = comment.span.start as usize;
        }
        false
    }
}

impl<'a> Visit<'a> for Transformer<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        self.ancestors.push(kind);
    }

    fn leave_node(&mut self, _kind: AstKind<'a>) {
        self.ancestors.pop();
    }

    fn visit_directive(&mut self, _directive: &Directive<'a>) {
        // Babel's DirectiveLiteral is separate from StringLiteral; all directives
        // retain their original spelling, including framework "use" directives.
    }

    fn visit_string_literal(&mut self, literal: &StringLiteral<'a>) {
        if self.ignored_string(literal.span) {
            return;
        }
        let raw = literal.value.as_str();
        if let Some(events) = &mut self.events {
            events.push(literal_event(
                self.source,
                raw,
                literal.span.start + 1,
                literal.span.end - 1,
                "js",
                literal.lone_surrogates,
                self.split_quote,
            ));
            return;
        }
        // When a literal contains a lone surrogate, Oxc encodes both surrogates
        // and genuine U+FFFD characters with an escape marker. Encode external
        // names into that representation too, so generated U+FFFD text cannot
        // accidentally become a surrogate escape on output.
        let encoded_context;
        let context = if literal.lone_surrogates {
            encoded_context = TransformContext {
                replacements: self
                    .context
                    .replacements
                    .iter()
                    .map(|(key, value)| {
                        (
                            key.replace('\u{fffd}', "\u{fffd}fffd"),
                            value.replace('\u{fffd}', "\u{fffd}fffd"),
                        )
                    })
                    .collect(),
                preserved: HashSet::new(),
            };
            &encoded_context
        } else {
            self.context
        };
        let (replaced, mut used) = text::replace_tokens(raw, context, self.split_quote);
        if literal.lone_surrogates {
            for value in &mut used {
                *value = value.replace("\u{fffd}fffd", "\u{fffd}");
            }
        }
        self.result.used.extend(used);
        if replaced != raw && literal.span.end > literal.span.start + 2 {
            self.result.edits.push(Edit {
                start: literal.span.start + 1,
                end: literal.span.end - 1,
                content: escape_js_string(&replaced, literal.lone_surrogates),
            });
        }
    }

    fn visit_template_element(&mut self, element: &TemplateElement<'a>) {
        let raw = element.value.raw.as_str();
        if let Some(events) = &mut self.events {
            events.push(literal_event(
                self.source,
                raw,
                element.span.start,
                element.span.end,
                "text",
                false,
                self.split_quote,
            ));
            return;
        }
        let (replaced, used) = text::replace_tokens(raw, self.context, self.split_quote);
        self.result.used.extend(used);
        if replaced != raw && element.span.start < element.span.end {
            self.result.edits.push(Edit {
                start: element.span.start,
                end: element.span.end,
                content: replaced,
            });
        }
    }

    fn visit_tagged_template_expression(&mut self, expression: &TaggedTemplateExpression<'a>) {
        if matches!(&expression.tag, Expression::Identifier(identifier) if identifier.name == "twIgnore")
        {
            self.ignored_templates.insert(expression.quasi.span.start);
        }
        walk::walk_tagged_template_expression(self, expression);
    }

    fn visit_template_literal(&mut self, literal: &TemplateLiteral<'a>) {
        if self.ignored_templates.contains(&literal.span.start) {
            for quasi in &literal.quasis {
                let values = text::split_code(quasi.value.raw.as_str(), self.split_quote);
                if let Some(events) = &mut self.events {
                    events.push(CallbackEvent {
                        kind: "preserve".into(),
                        values,
                        ..Default::default()
                    });
                } else {
                    for value in values {
                        self.preserve(value);
                    }
                }
            }
            // Only the directly tagged quasis are ignored. Expressions inside
            // the template still transform and may contain other templates.
            self.visit_expressions(&literal.expressions);
        } else {
            walk::walk_template_literal(self, literal);
        }
    }

    fn visit_call_expression(&mut self, call: &CallExpression<'a>) {
        if let Some(events) = &mut self.events {
            if !call.optional
                && let Expression::Identifier(identifier) = &call.callee
            {
                let mut collector = PreserveCollector {
                    context: None,
                    values: Vec::new(),
                };
                walk::walk_call_expression(&mut collector, call);
                events.push(CallbackEvent {
                    kind: "call".into(),
                    raw: identifier.name.to_string(),
                    values: collector.values,
                    ..Default::default()
                });
            }
        } else if !call.optional
            && matches!(&call.callee, Expression::Identifier(identifier)
                if self.preserve_functions.iter().any(|name| name == identifier.name.as_str()))
        {
            let mut collector = PreserveCollector {
                context: Some(self.context),
                values: Vec::new(),
            };
            walk::walk_call_expression(&mut collector, call);
            for value in collector.values {
                self.preserve(value);
            }
        }
        walk::walk_call_expression(self, call);
    }
}

struct PreserveCollector<'s> {
    context: Option<&'s TransformContext>,
    values: Vec<String>,
}

impl PreserveCollector<'_> {
    fn collect(&mut self, raw: &str, lone_surrogates: bool) {
        // Preserve function discovery intentionally always splits quotes, just
        // like Babel's splitCode(value), independently of transform splitQuote.
        let mut tokens = text::split_code(raw, true);
        tokens.sort_by_cached_key(|value| std::cmp::Reverse(value.encode_utf16().count()));
        self.values.extend(tokens.into_iter().filter_map(|token| {
            let decoded = if lone_surrogates {
                decode_oxc_selector(&token)?
            } else {
                token
            };
            self.context
                .is_none_or(|context| context.replacements.contains_key(&decoded))
                .then_some(decoded)
        }));
    }
}

impl<'a> Visit<'a> for PreserveCollector<'_> {
    fn visit_directive(&mut self, _directive: &Directive<'a>) {}

    fn visit_string_literal(&mut self, literal: &StringLiteral<'a>) {
        self.collect(literal.value.as_str(), literal.lone_surrogates);
    }

    fn visit_template_element(&mut self, element: &TemplateElement<'a>) {
        self.collect(element.value.raw.as_str(), false);
    }
}

fn decode_oxc_selector(value: &str) -> Option<String> {
    let mut decoded = String::with_capacity(value.len());
    let mut chars = value.chars();
    while let Some(ch) = chars.next() {
        if ch == '\u{fffd}' {
            let code: String = chars.by_ref().take(4).collect();
            if !code.eq_ignore_ascii_case("fffd") {
                return None;
            }
        }
        decoded.push(ch);
    }
    Some(decoded)
}

fn escape_js_string(value: &str, lone_surrogates: bool) -> String {
    let mut escaped = String::with_capacity(value.len());
    let mut chars = value.chars().peekable();
    while let Some(ch) = chars.next() {
        if lone_surrogates && ch == '\u{fffd}' {
            let code: String = chars.by_ref().take(4).collect();
            if code.eq_ignore_ascii_case("fffd") {
                escaped.push('\u{fffd}');
            } else {
                escaped.push_str("\\u");
                escaped.push_str(&code);
            }
            continue;
        }
        match ch {
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\u{2028}' => escaped.push_str("\\u2028"),
            '\u{2029}' => escaped.push_str("\\u2029"),
            '"' | '\'' | '\\' => {
                escaped.push('\\');
                escaped.push(ch);
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

/// A compact visitor-order callback plan, never an AST. The normal transform
/// remains a single native call; this plan is only used for live JS callbacks.
#[napi(object)]
#[derive(Default)]
pub struct CallbackEvent {
    pub kind: String,
    pub raw: String,
    pub values: Vec<String>,
    pub start: u32,
    pub end: u32,
    pub mode: String,
    pub lone_surrogates: bool,
}

#[napi(object)]
pub struct CallbackPlan {
    pub events: Vec<CallbackEvent>,
    pub valid: bool,
}

pub(crate) fn literal_event(
    source: &str,
    raw: &str,
    start: u32,
    end: u32,
    mode: &str,
    lone_surrogates: bool,
    split_quote: bool,
) -> CallbackEvent {
    let values = text::split_code(raw, split_quote)
        .into_iter()
        .filter_map(|value| {
            if lone_surrogates {
                decode_oxc_selector(&value)
            } else {
                Some(value)
            }
        })
        .collect();
    CallbackEvent {
        kind: "literal".into(),
        raw: raw.into(),
        values,
        start: source[..start as usize].encode_utf16().count() as u32,
        end: source[..end as usize].encode_utf16().count() as u32,
        mode: mode.into(),
        lone_surrogates,
    }
}

#[napi]
pub fn plan_js_native(source: String, split_quote: bool) -> CallbackPlan {
    let mut events = Vec::new();
    let result = run(
        &source,
        &TransformContext::default(),
        &[],
        split_quote,
        Some(&mut events),
    );
    CallbackPlan {
        events: if result.valid { events } else { Vec::new() },
        valid: result.valid,
    }
}

#[napi]
pub fn plan_text_native(source: String, split_quote: bool) -> CallbackPlan {
    CallbackPlan {
        events: vec![literal_event(
            &source,
            &source,
            0,
            source.len() as u32,
            "text",
            false,
            split_quote,
        )],
        valid: true,
    }
}

/// Apply choices captured at each JS callback, in their original order. Repeated
/// candidates and callbacks which mutate later mappings retain legacy behavior.
#[napi]
pub fn execute_literal_native(
    event: CallbackEvent,
    replacements: Vec<Replacement>,
) -> Option<Edit> {
    let mut content = event.raw.clone();
    for choice in replacements {
        let encode = |value: String| {
            if event.lone_surrogates {
                value.replace('\u{fffd}', "\u{fffd}fffd")
            } else {
                value
            }
        };
        content = text::replace_selected_token(
            &content,
            &encode(choice.original),
            &encode(choice.replacement),
        );
    }
    if content == event.raw || event.start >= event.end {
        return None;
    }
    let content = match event.mode.as_str() {
        "js" => escape_js_string(&content, event.lone_surrogates),
        "html-single" => crate::html::escape_attribute(&content, Some(b'\'')),
        "html-double" => crate::html::escape_attribute(&content, Some(b'"')),
        "html-unquoted" => crate::html::escape_attribute(&content, None),
        _ => content,
    };
    Some(Edit {
        start: event.start,
        end: event.end,
        content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn context() -> TransformContext {
        TransformContext {
            replacements: HashMap::from([
                ("p-1".into(), "tw-a".into()),
                ("p-2".into(), "tw-b".into()),
                ("p-3".into(), "tw-c".into()),
            ]),
            preserved: HashSet::new(),
        }
    }

    fn apply(source: &str, result: &TransformResult) -> String {
        let mut code: Vec<u16> = source.encode_utf16().collect();
        for edit in result.edits.iter().rev() {
            code.splice(
                edit.start as usize..edit.end as usize,
                edit.content.encode_utf16(),
            );
        }
        String::from_utf16(&code).unwrap()
    }

    #[test]
    fn js_transforms_tsx_decoded_strings_and_utf16_positions() {
        let source = "const emoji = '😀'; const x: string = 'p\\x2d1'; <div className=\"p-2\"/>";
        let result = transform(source, &context(), &[], true);
        assert!(result.valid);
        assert_eq!(
            apply(source, &result),
            "const emoji = '😀'; const x: string = 'tw-a'; <div className=\"tw-b\"/>"
        );
        assert_eq!(result.used, ["p-1", "p-2"]);
    }

    #[test]
    fn js_preserves_babel_template_visit_order_and_raw_escapes() {
        let source = "const x = `p-1 ${'p-2'} p-3`; const y = `p\\x2d1`;";
        let result = transform(source, &context(), &[], true);
        assert_eq!(result.used, ["p-1", "p-3", "p-2"]);
        assert_eq!(
            apply(source, &result),
            "const x = `tw-a ${'tw-b'} tw-c`; const y = `p\\x2d1`;"
        );
    }

    #[test]
    fn js_ignores_tagged_quasis_but_transforms_their_expressions() {
        let source = "const x = twIgnore`p-1 unknown ${'p-2'} ${`p-3`}`";
        let result = transform(source, &context(), &[], true);
        assert_eq!(result.preserved, ["p-1", "unknown"]);
        assert_eq!(result.used, ["p-2", "p-3"]);
        assert_eq!(
            apply(source, &result),
            "const x = twIgnore`p-1 unknown ${'tw-b'} ${`tw-c`}`"
        );
    }

    #[test]
    fn js_preserve_calls_collect_descendants_even_when_ignored() {
        let source = "cn({ 'p-1': fn(/* tw-mangle ignore */ 'p-2') }, twIgnore`p-3`); cn?.('p-1');";
        let result = transform(source, &context(), &["cn".into()], true);
        assert_eq!(result.preserved, ["p-1", "p-2", "p-3"]);
        assert_eq!(result.used, ["p-1", "p-1"]);
        assert_eq!(
            apply(source, &result),
            "cn({ 'tw-a': fn(/* tw-mangle ignore */ 'p-2') }, twIgnore`p-3`); cn?.('tw-a');"
        );
    }

    #[test]
    fn js_keeps_directives_and_attaches_ignore_to_the_correct_node() {
        let source = "'p-1'; function f() { 'use server'; return /* tw-mangle ignore */ 'p-1' }; const x = { /* tw-mangle ignore */ 'p-1': 'p-2' }; type T = /* tw-mangle ignore */ 'p-3';";
        let result = transform(source, &context(), &[], true);
        assert_eq!(result.used, ["p-1", "p-2", "p-3"]);
        assert_eq!(
            apply(source, &result),
            "'p-1'; function f() { 'use server'; return /* tw-mangle ignore */ 'p-1' }; const x = { /* tw-mangle ignore */ 'tw-a': 'tw-b' }; type T = /* tw-mangle ignore */ 'tw-c';"
        );
    }

    #[test]
    fn js_escapes_custom_names_and_retains_lone_surrogates() {
        let mut ctx = context();
        ctx.replacements
            .insert("p-1".into(), "tw-\"quote\\path\n\u{2028}".into());
        let source = "const x = 'p-1 \\ud800';";
        let result = transform(source, &ctx, &[], true);
        assert_eq!(
            apply(source, &result),
            "const x = 'tw-\\\"quote\\\\path\\n\\u2028 \\ud800';"
        );
    }

    #[test]
    fn js_lone_surrogate_encoding_does_not_consume_generated_replacement_characters() {
        let mut ctx = context();
        ctx.replacements
            .insert("p-1".into(), "tw-\u{fffd}next".into());
        let source = "const x = 'p-1 \\ud800';";
        let result = transform(source, &ctx, &[], true);
        assert_eq!(
            apply(source, &result),
            "const x = 'tw-\u{fffd}next \\ud800';"
        );
    }

    #[test]
    fn js_invalid_source_is_unchanged() {
        let source = "const x = 'p-1'; <div>";
        let result = transform(source, &context(), &[], true);
        assert!(!result.valid);
        assert!(result.used.is_empty());
        assert!(result.edits.is_empty());
    }

    #[test]
    fn js_early_syntax_errors_are_unchanged() {
        for source in [
            "let x; let x; const k = 'p-1';",
            "export { missing }; const k = 'p-1';",
            "class A { f() { return this.#missing + 'p-1' } }",
        ] {
            let result = transform(source, &context(), &[], true);
            assert!(!result.valid, "accepted invalid source: {source}");
            assert!(result.edits.is_empty());
        }
    }

    #[test]
    fn js_records_identity_replacements_without_edits() {
        let mut ctx = context();
        ctx.replacements.insert("p-1".into(), "p-1".into());
        let result = transform("const x = 'p-1';", &ctx, &[], true);
        assert_eq!(result.used, ["p-1"]);
        assert!(result.edits.is_empty());
    }

    #[test]
    fn callback_plan_keeps_all_candidates_and_ordered_preservation() {
        let plan = plan_js_native(
            "const a='p-1 missing'; cx('p-2'); twIgnore`p-3`;".into(),
            true,
        );
        assert!(plan.valid);
        assert_eq!(
            plan.events
                .iter()
                .map(|event| event.kind.as_str())
                .collect::<Vec<_>>(),
            ["literal", "call", "literal", "preserve"]
        );
        assert_eq!(plan.events[0].values, ["p-1", "missing"]);
        assert_eq!(plan.events[1].values, ["p-2"]);
        let invalid = plan_js_native("let x; let x; 'p-1'".into(), true);
        assert!(!invalid.valid);
        assert!(invalid.events.is_empty());
    }

    #[test]
    fn callback_literal_retains_unicode_positions_and_surrogates() {
        let plan = plan_js_native("const emoji='😀'; const a='p-1 \\ud800'".into(), true);
        let event = plan.events.into_iter().last().unwrap();
        let start = event.start;
        let edit = execute_literal_native(
            event,
            vec![Replacement {
                original: "p-1".into(),
                replacement: "tw-\u{fffd}".into(),
            }],
        )
        .unwrap();
        assert_eq!(edit.start, start);
        assert_eq!(edit.content, "tw-\u{fffd} \\ud800");
    }
}

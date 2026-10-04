//! Tailwind distribution patches. Rust owns parsing and structural matching;
//! JavaScript owns package resolution and writing the selected files.
use std::collections::HashSet;

use napi::{Error, Result, Status};
use napi_derive::napi;
use oxc_allocator::Allocator;
use oxc_ast::{AstKind, ast::*};
use oxc_ast_visit::Visit;
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::SemanticBuilder;
use oxc_span::{GetSpan, SourceType, Span};

#[napi(object)]
pub struct PatchResult {
    pub code: String,
    pub has_patched: bool,
    pub matched: bool,
}

#[napi(object)]
pub struct LengthUnitsPatchResult {
    pub code: String,
    pub changed: bool,
    pub matched: bool,
}

#[napi(object)]
pub struct LengthUnitsInspection {
    pub found: bool,
    pub missing_units: Vec<String>,
}

fn parse_source<'a>(allocator: &'a Allocator, source: &'a str) -> Result<Program<'a>> {
    let parsed = Parser::new(allocator, source, SourceType::unambiguous())
        .with_options(ParseOptions {
            preserve_parens: false,
            ..Default::default()
        })
        .parse();
    if parsed.panicked || !parsed.diagnostics.is_empty() {
        return Err(Error::new(
            Status::InvalidArg,
            "Unable to parse Tailwind JavaScript source",
        ));
    }
    if !SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program)
        .diagnostics
        .is_empty()
    {
        return Err(Error::new(
            Status::InvalidArg,
            "Invalid Tailwind JavaScript source",
        ));
    }
    Ok(parsed.program)
}

struct ByteEdit {
    span: Span,
    content: String,
}

fn apply_edits(source: &str, mut edits: Vec<ByteEdit>) -> String {
    edits.sort_by_key(|edit| (edit.span.start, edit.span.end));
    let mut result = String::with_capacity(source.len());
    let mut cursor = 0;
    for edit in edits {
        result.push_str(&source[cursor..edit.span.start as usize]);
        result.push_str(&edit.content);
        cursor = edit.span.end as usize;
    }
    result.push_str(&source[cursor..]);
    result
}

fn indentation_at(source: &str, offset: u32) -> &str {
    let prefix = &source[..offset as usize];
    let line = prefix.rsplit_once('\n').map_or(prefix, |(_, line)| line);
    if line.bytes().all(|ch| ch == b' ' || ch == b'\t') {
        line
    } else {
        ""
    }
}

fn quote(value: &str, quote: char) -> String {
    let mut result = String::with_capacity(value.len() + 2);
    result.push(quote);
    for ch in value.chars() {
        match ch {
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            '\u{2028}' => result.push_str("\\u2028"),
            '\u{2029}' => result.push_str("\\u2029"),
            ch if ch == quote => {
                result.push('\\');
                result.push(ch);
            }
            ch if ch <= '\u{001f}' => result.push_str(&format!("\\u{:04x}", ch as u32)),
            _ => result.push(ch),
        }
    }
    result.push(quote);
    result
}

fn identifier_name(property: &str) -> String {
    if property.is_empty() {
        return "contextRef".into();
    }
    let mut name: String = property
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '$' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    if name.as_bytes()[0].is_ascii_digit()
        || matches!(
            name.as_str(),
            "await"
                | "break"
                | "case"
                | "catch"
                | "class"
                | "const"
                | "continue"
                | "debugger"
                | "default"
                | "delete"
                | "do"
                | "else"
                | "enum"
                | "export"
                | "extends"
                | "false"
                | "finally"
                | "for"
                | "function"
                | "if"
                | "import"
                | "in"
                | "instanceof"
                | "let"
                | "new"
                | "null"
                | "return"
                | "static"
                | "super"
                | "switch"
                | "this"
                | "throw"
                | "true"
                | "try"
                | "typeof"
                | "var"
                | "void"
                | "while"
                | "with"
                | "yield"
        )
    {
        name.insert(0, '_');
    }
    name
}

fn export_member(property: &str, version: u32) -> String {
    let object = if version == 2 {
        "exports"
    } else {
        "module.exports"
    };
    let mut chars = property.chars();
    let identifier = chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_' || c == '$')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
    if identifier {
        format!("{object}.{property}")
    } else {
        format!("{object}[{}]", quote(property, '"'))
    }
}

fn is_identifier(expression: &Expression<'_>, name: &str) -> bool {
    matches!(expression, Expression::Identifier(identifier) if identifier.name == name)
}

fn static_member<'s, 'a>(
    expression: &'s Expression<'a>,
    property: &str,
) -> Option<&'s Expression<'a>> {
    match expression {
        Expression::StaticMemberExpression(member) if member.property.name == property => {
            Some(&member.object)
        }
        Expression::ComputedMemberExpression(member) if matches!(&member.expression, Expression::StringLiteral(value) if value.value == property) => {
            Some(&member.object)
        }
        _ => None,
    }
}

fn member_object<'s, 'a>(expression: &'s Expression<'a>) -> Option<&'s Expression<'a>> {
    match expression {
        Expression::StaticMemberExpression(member) => Some(&member.object),
        Expression::ComputedMemberExpression(member) => Some(&member.object),
        _ => None,
    }
}

fn returned_expression<'s, 'a>(function: &'s Function<'a>) -> Option<&'s Expression<'a>> {
    let body = function.body.as_ref()?;
    if body.statements.len() != 1 {
        return None;
    }
    let Statement::ReturnStatement(statement) = &body.statements[0] else {
        return None;
    };
    statement.argument.as_ref()
}

fn target_plugin<'s, 'a>(function: &'s Function<'a>, version: u32) -> Option<&'s Function<'a>> {
    let returned = returned_expression(function)?;
    let plugins = if version == 2 {
        returned
    } else {
        let Expression::ObjectExpression(object) = returned else {
            return None;
        };
        if object.properties.len() != 2 {
            return None;
        }
        object.properties.iter().find_map(|property| {
            let ObjectPropertyKind::ObjectProperty(property) = property else { return None; };
            if matches!(&property.key, PropertyKey::StaticIdentifier(identifier) if identifier.name == "plugins") {
                Some(&property.value)
            } else { None }
        })?
    };
    let Expression::CallExpression(call) = plugins else {
        return None;
    };
    let Expression::ArrayExpression(array) = member_object(&call.callee)? else {
        return None;
    };
    let ArrayExpressionElement::FunctionExpression(function) = array.elements.get(1)? else {
        return None;
    };
    Some(function)
}

#[napi]
pub fn patch_return_context_native(source: String) -> Result<PatchResult> {
    let allocator = Allocator::default();
    let program = parse_source(&allocator, &source)?;
    let mut visitor = ReturnContextVisitor {
        source: &source,
        edits: Vec::new(),
        matched: false,
    };
    visitor.visit_program(&program);
    let has_patched = visitor.matched && visitor.edits.is_empty();
    Ok(PatchResult {
        code: apply_edits(&source, visitor.edits),
        has_patched,
        matched: visitor.matched,
    })
}

struct ReturnContextVisitor<'s> {
    source: &'s str,
    edits: Vec<ByteEdit>,
    matched: bool,
}

impl<'a> Visit<'a> for ReturnContextVisitor<'_> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        let AstKind::Function(function) = kind else {
            return;
        };
        if function.r#type != FunctionType::FunctionDeclaration
            || !function
                .id
                .as_ref()
                .is_some_and(|id| id.name == "processTailwindFeatures")
        {
            return;
        }
        let Some(Expression::FunctionExpression(returned)) = returned_expression(function) else {
            return;
        };
        let Some(body) = &returned.body else {
            return;
        };
        self.matched = true;
        if matches!(body.statements.last(), Some(Statement::ReturnStatement(statement))
            if statement.argument.as_ref().is_some_and(|expression| is_identifier(expression, "context")))
        {
            return;
        }
        let end = body.span.end - 1;
        let closing_indent = indentation_at(self.source, end);
        let (offset, content) = if !closing_indent.is_empty() {
            let inner_indent = body
                .statements
                .first()
                .map(|statement| indentation_at(self.source, statement.span().start))
                .unwrap_or("");
            let indent = if inner_indent.is_empty() {
                format!("{closing_indent}  ")
            } else {
                inner_indent.to_owned()
            };
            (
                end - closing_indent.len() as u32,
                format!("{indent}return context;\n"),
            )
        } else {
            (end, "\nreturn context;\n".into())
        };
        self.edits.push(ByteEdit {
            span: Span::new(offset, offset),
            content,
        });
    }
}

fn exports_assignment(statement: &Statement<'_>, property: &str, name: &str, version: u32) -> bool {
    let Statement::ExpressionStatement(statement) = statement else {
        return false;
    };
    let Expression::AssignmentExpression(assignment) = &statement.expression else {
        return false;
    };
    if !is_identifier(&assignment.right, name) {
        return false;
    }
    let object = match &assignment.left {
        AssignmentTarget::StaticMemberExpression(member) if member.property.name == property => {
            &member.object
        }
        AssignmentTarget::ComputedMemberExpression(member) if matches!(&member.expression, Expression::StringLiteral(value) if value.value == property) => {
            &member.object
        }
        _ => return false,
    };
    if version == 2 {
        is_identifier(object, "exports")
    } else {
        static_member(object, "exports").is_some_and(|object| is_identifier(object, "module"))
    }
}

fn context_variable(statement: &Statement<'_>, name: &str) -> bool {
    let Statement::VariableDeclaration(declaration) = statement else {
        return false;
    };
    declaration
        .declarations
        .iter()
        .any(|item| matches!(&item.id, BindingPattern::BindingIdentifier(id) if id.name == name))
}

fn already_pushes(expression: &Expression<'_>, name: &str) -> bool {
    let Expression::CallExpression(call) = expression else {
        return false;
    };
    static_member(&call.callee, "push")
        .and_then(|value| static_member(value, "value"))
        .is_some_and(|object| is_identifier(object, name))
}

fn resets_context(statement: &Statement<'_>, name: &str) -> bool {
    let Statement::ExpressionStatement(statement) = statement else {
        return false;
    };
    let Expression::AssignmentExpression(assignment) = &statement.expression else {
        return false;
    };
    if !matches!(&assignment.right, Expression::NumericLiteral(value) if value.value == 0.0) {
        return false;
    }
    let AssignmentTarget::StaticMemberExpression(member) = &assignment.left else {
        return false;
    };
    member.property.name == "length"
        && static_member(&member.object, "value").is_some_and(|object| is_identifier(object, name))
}

fn wrap_expression(
    source: &str,
    expression: &Expression<'_>,
    name: &str,
    edits: &mut Vec<ByteEdit>,
) {
    if !already_pushes(expression, name) {
        let span = expression.span();
        edits.push(ByteEdit {
            span,
            content: format!(
                "{name}.value.push({})",
                &source[span.start as usize..span.end as usize]
            ),
        });
    }
}

fn patch_plugin_body(source: &str, function: &Function<'_>, name: &str, edits: &mut Vec<ByteEdit>) {
    let Some(body) = &function.body else {
        return;
    };
    if !body
        .statements
        .first()
        .is_some_and(|statement| resets_context(statement, name))
    {
        // Keep directives at the beginning of the function.
        let offset = body
            .statements
            .first()
            .map_or(body.span.end - 1, |statement| statement.span().start);
        edits.push(ByteEdit {
            span: Span::new(offset, offset),
            content: format!(
                "{name}.value.length = 0;\n{}",
                indentation_at(source, offset)
            ),
        });
    }
    if let Some(Statement::ExpressionStatement(last)) = body.statements.last() {
        wrap_expression(source, &last.expression, name, edits);
    }
    let Some(Statement::IfStatement(statement)) = body
        .statements
        .iter()
        .find(|statement| matches!(statement, Statement::IfStatement(_)))
    else {
        return;
    };
    let Statement::BlockStatement(block) = &statement.consequent else {
        return;
    };
    let Some(Statement::ForOfStatement(for_of)) = block.body.get(1) else {
        return;
    };
    let Statement::BlockStatement(block) = &for_of.body else {
        return;
    };
    let Some(Statement::IfStatement(nested)) = block.body.first() else {
        return;
    };
    let Statement::BlockStatement(block) = &nested.consequent else {
        return;
    };
    if block.body.len() == 1
        && let Statement::ExpressionStatement(statement) = &block.body[0]
    {
        wrap_expression(source, &statement.expression, name, edits);
    }
}

#[napi]
pub fn patch_postcss_plugin_native(
    source: String,
    ref_property: String,
    version: u32,
) -> Result<PatchResult> {
    if version != 2 && version != 3 {
        return Err(Error::new(
            Status::InvalidArg,
            "Context patches require Tailwind v2 or v3",
        ));
    }
    let allocator = Allocator::default();
    let program = parse_source(&allocator, &source)?;
    let name = identifier_name(&ref_property);
    let entry = program.body.iter().find_map(|statement| {
        if version == 2 {
            if let Statement::FunctionDeclaration(function) = statement
                && function.id.as_ref().is_some_and(|id| id.name == "_default")
            {
                return Some((statement.span(), function.as_ref()));
            }
        } else if let Statement::ExpressionStatement(statement) = statement
            && let Expression::AssignmentExpression(assignment) = &statement.expression
            && matches!(
                &assignment.left,
                AssignmentTarget::StaticMemberExpression(_)
                    | AssignmentTarget::ComputedMemberExpression(_)
            )
            && let Expression::FunctionExpression(function) = &assignment.right
            && function
                .id
                .as_ref()
                .is_some_and(|id| id.name == "tailwindcss")
        {
            return Some((statement.span, function.as_ref()));
        }
        None
    });
    let Some((entry_span, entry_function)) = entry else {
        return Ok(PatchResult {
            code: source,
            has_patched: false,
            matched: false,
        });
    };
    let Some(plugin) = target_plugin(entry_function, version) else {
        return Ok(PatchResult {
            code: source,
            has_patched: false,
            matched: false,
        });
    };
    let mut edits = Vec::new();
    let has_variable = program
        .body
        .iter()
        .any(|statement| context_variable(statement, &name));
    let has_export = program
        .body
        .iter()
        .any(|statement| exports_assignment(statement, &ref_property, &name, version));
    let mut declaration = String::new();
    if !has_variable {
        declaration = format!(
            "{} {name} = {{ value: [] }};\n",
            if version == 2 { "var" } else { "const" }
        );
    }
    if version == 2 && !has_export {
        declaration.push_str(&format!(
            "{} = {name};\n",
            export_member(&ref_property, version)
        ));
    }
    if !declaration.is_empty() {
        edits.push(ByteEdit {
            span: Span::new(entry_span.start, entry_span.start),
            content: declaration,
        });
    }
    if version == 3 && !has_export {
        let end = source.len() as u32;
        edits.push(ByteEdit {
            span: Span::new(end, end),
            content: format!("\n{} = {name};\n", export_member(&ref_property, version)),
        });
    }
    patch_plugin_body(&source, plugin, &name, &mut edits);
    let has_patched = edits.is_empty();
    Ok(PatchResult {
        code: apply_edits(&source, edits),
        has_patched,
        matched: true,
    })
}

struct ArrayFinder<'s, 'a> {
    variable: Option<&'s str>,
    array: Option<&'a ArrayExpression<'a>>,
}

impl<'a> Visit<'a> for ArrayFinder<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        if self.array.is_some() {
            return;
        }
        match kind {
            AstKind::VariableDeclarator(declaration) => {
                if self.variable.is_some_and(|name| matches!(&declaration.id, BindingPattern::BindingIdentifier(id) if id.name == name))
                    && let Some(Expression::ArrayExpression(array)) = &declaration.init { self.array = Some(array); }
            }
            AstKind::ArrayExpression(array) if self.variable.is_none()
                && matches!(array.elements.first(), Some(ArrayExpressionElement::StringLiteral(value)) if value.value == "cm")
                    && matches!(array.elements.get(1), Some(ArrayExpressionElement::StringLiteral(value)) if value.value == "mm")
                    && array.elements.iter().all(|value| matches!(value, ArrayExpressionElement::StringLiteral(_))) => {
                    self.array = Some(array);
                }
            _ => {}
        }
    }
}

fn find_array<'a>(
    program: &'a Program<'a>,
    variable: Option<&str>,
) -> Option<&'a ArrayExpression<'a>> {
    let mut finder = ArrayFinder {
        variable,
        array: None,
    };
    finder.visit_program(program);
    finder.array
}

fn array_units(array: &ArrayExpression<'_>) -> HashSet<String> {
    array
        .elements
        .iter()
        .filter_map(|element| {
            if let ArrayExpressionElement::StringLiteral(value) = element {
                Some(value.value.to_string())
            } else {
                None
            }
        })
        .collect()
}

#[napi]
pub fn inspect_length_units_native(
    source: String,
    variable_name: String,
    units: Vec<String>,
) -> Result<LengthUnitsInspection> {
    let allocator = Allocator::default();
    let program = parse_source(&allocator, &source)?;
    let Some(array) = find_array(&program, Some(&variable_name)) else {
        return Ok(LengthUnitsInspection {
            found: false,
            missing_units: Vec::new(),
        });
    };
    let existing = array_units(array);
    Ok(LengthUnitsInspection {
        found: true,
        missing_units: units
            .into_iter()
            .filter(|unit| !existing.contains(unit))
            .collect(),
    })
}

#[napi]
pub fn patch_length_units_native(
    source: String,
    units: Vec<String>,
    variable_name: Option<String>,
) -> Result<LengthUnitsPatchResult> {
    let allocator = Allocator::default();
    let program = parse_source(&allocator, &source)?;
    let Some(array) = find_array(&program, variable_name.as_deref()) else {
        return Ok(LengthUnitsPatchResult {
            code: source,
            changed: false,
            matched: false,
        });
    };
    let mut existing = array_units(array);
    let missing: Vec<_> = units
        .into_iter()
        .filter(|unit| existing.insert(unit.clone()))
        .collect();
    if missing.is_empty() {
        return Ok(LengthUnitsPatchResult {
            code: source,
            changed: false,
            matched: true,
        });
    }
    let quote_char = if variable_name.is_some() { '\'' } else { '"' };
    let separator = if variable_name.is_some() { ", " } else { "," };
    let mut elements: Vec<String> = array
        .elements
        .iter()
        .map(|element| {
            if let ArrayExpressionElement::StringLiteral(value) = element {
                quote(value.value.as_str(), quote_char)
            } else {
                let span = element.span();
                source[span.start as usize..span.end as usize].to_owned()
            }
        })
        .collect();
    elements.extend(missing.iter().map(|unit| quote(unit, quote_char)));
    let code = apply_edits(
        &source,
        vec![ByteEdit {
            span: array.span,
            content: format!("[{}]", elements.join(separator)),
        }],
    );
    Ok(LengthUnitsPatchResult {
        code,
        changed: true,
        matched: true,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn return_context_is_structural_and_idempotent() {
        let source = "function processTailwindFeatures() { return function() { let context = {}; work(context); } }";
        let result = patch_return_context_native(source.into()).unwrap();
        assert!(!result.has_patched);
        assert!(result.code.contains("return context;"));
        let second = patch_return_context_native(result.code.clone()).unwrap();
        assert!(second.has_patched);
        assert_eq!(second.code, result.code);
    }

    #[test]
    fn plugin_fixtures_and_custom_properties_are_idempotent() {
        for (version, source) in [
            (
                2,
                include_str!(
                    "../../../packages/tailwindcss-patch/test/fixtures/versions/2/lib/jit/index.js"
                ),
            ),
            (
                3,
                include_str!(
                    "../../../packages/tailwindcss-patch/test/fixtures/versions/3.4.18/lib/plugin.js"
                ),
            ),
        ] {
            for property in ["contextRef", "123-contexts", "quoted\"name", "class"] {
                let first =
                    patch_postcss_plugin_native(source.into(), property.into(), version).unwrap();
                assert!(first.matched, "no plugin matched for v{version}");
                assert!(!first.has_patched);
                let second =
                    patch_postcss_plugin_native(first.code.clone(), property.into(), version)
                        .unwrap();
                assert!(
                    second.has_patched,
                    "not idempotent for v{version} property {property}"
                );
                assert_eq!(first.code, second.code);
            }
        }
    }

    #[test]
    fn length_units_adds_all_missing_units_once() {
        let source = "const units = ['cm', 'mm', 'rpx'];";
        let result = patch_length_units_native(
            source.into(),
            vec!["rpx".into(), "upx".into(), "upx".into()],
            None,
        )
        .unwrap();
        assert!(result.changed);
        assert_eq!(
            result.code,
            "const units = [\"cm\",\"mm\",\"rpx\",\"upx\"];"
        );
        assert!(
            !patch_length_units_native(result.code, vec!["rpx".into(), "upx".into()], None)
                .unwrap()
                .changed
        );
    }

    #[test]
    fn length_units_ignores_arrays_inside_comments_and_strings() {
        let source = "// [\"cm\",\"mm\"]\nconst text='[\"cm\",\"mm\"]';";
        assert!(
            !patch_length_units_native(source.into(), vec!["rpx".into()], None)
                .unwrap()
                .matched
        );
    }

    #[test]
    fn configurable_length_variable_and_inspection_agree() {
        let source = "const custom = ['px']; const lengthUnits = ['em'];";
        let result =
            patch_length_units_native(source.into(), vec!["rpx".into()], Some("custom".into()))
                .unwrap();
        assert_eq!(
            result.code,
            "const custom = ['px', 'rpx']; const lengthUnits = ['em'];"
        );
        let status = inspect_length_units_native(
            result.code,
            "custom".into(),
            vec!["rpx".into(), "upx".into()],
        )
        .unwrap();
        assert!(status.found);
        assert_eq!(status.missing_units, ["upx"]);
    }

    #[test]
    fn invalid_source_is_an_error_not_an_unpatched_result() {
        assert!(patch_return_context_native("function {".into()).is_err());
        assert!(patch_length_units_native("const x = [".into(), vec![], None).is_err());
    }
}

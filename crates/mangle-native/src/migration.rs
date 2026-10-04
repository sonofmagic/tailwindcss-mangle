use std::collections::{HashMap, HashSet};

use napi_derive::napi;
use oxc_allocator::{Allocator, ArenaVec};
use oxc_ast::{ast::*, builder::AstBuilder};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{GetSpan, SPAN, SourceType, Span};

#[napi(object)]
pub struct ConfigSourceMigrationResult {
    pub changed: bool,
    pub code: String,
    pub changes: Vec<String>,
}

struct PropertyLayout {
    before: Span,
    key: Span,
    value: Span,
    computed: bool,
    shorthand: bool,
}

struct ObjectLayout {
    after: Span,
}

/// Preserve source outside the migrated object and retain every comment inside
/// it. Oxc codegen intentionally drops trailing comments, so configuration
/// rewriting uses parsed node boundaries instead of regenerating the program.
struct SourcePrinter<'s> {
    source: &'s str,
    properties: HashMap<(u32, u32), PropertyLayout>,
    objects: HashMap<(u32, u32), ObjectLayout>,
    comments: Vec<Span>,
    emitted_comments: HashSet<(u32, u32)>,
}

impl<'s> SourcePrinter<'s> {
    fn new(source: &'s str, comments: &[Comment]) -> Self {
        Self {
            source,
            properties: HashMap::new(),
            objects: HashMap::new(),
            comments: comments.iter().map(|comment| comment.span).collect(),
            emitted_comments: HashSet::new(),
        }
    }

    fn remember(&mut self, object: &ObjectExpression<'_>) {
        let mut previous_end = object.span.start + 1;
        for property in &object.properties {
            let span = property.span();
            let before = Span::new(previous_end, span.start);
            match property {
                ObjectPropertyKind::ObjectProperty(property) => {
                    self.properties.insert(
                        (span.start, span.end),
                        PropertyLayout {
                            before,
                            key: property.key.span(),
                            value: property.value.span(),
                            computed: property.computed,
                            shorthand: property.shorthand,
                        },
                    );
                    if let Expression::ObjectExpression(child) = &property.value {
                        self.remember(child);
                    }
                }
                ObjectPropertyKind::SpreadProperty(_) => {
                    self.properties.insert(
                        (span.start, span.end),
                        PropertyLayout {
                            before,
                            key: span,
                            value: span,
                            computed: false,
                            shorthand: false,
                        },
                    );
                }
            }
            previous_end = span.end;
        }
        self.objects.insert(
            (object.span.start, object.span.end),
            ObjectLayout {
                after: Span::new(previous_end, object.span.end - 1),
            },
        );
    }

    fn raw(&mut self, span: Span) -> String {
        for comment in &self.comments {
            if comment.start >= span.start && comment.end <= span.end {
                self.emitted_comments.insert((comment.start, comment.end));
            }
        }
        self.source[span.start as usize..span.end as usize].to_string()
    }

    fn object(&mut self, object: &ObjectExpression<'_>) -> String {
        let mut code = String::from("{");
        for (index, property) in object.properties.iter().enumerate() {
            if index > 0 {
                code.push(',');
            }
            let span = property.span();
            if let Some(layout) = self.properties.get(&(span.start, span.end)) {
                let before = layout.before;
                code.push_str(&without_separator(&self.raw(before)));
            } else {
                code.push(' ');
            }
            code.push_str(&self.property(property));
        }
        if let Some(layout) = self.objects.get(&(object.span.start, object.span.end)) {
            let after = layout.after;
            code.push_str(&without_separator(&self.raw(after)));
        } else if !object.properties.is_empty() {
            code.push(' ');
        }
        code.push('}');
        code
    }

    fn property(&mut self, property: &ObjectPropertyKind<'_>) -> String {
        let ObjectPropertyKind::ObjectProperty(property) = property else {
            return self.raw(property.span());
        };
        if property.method || property.kind != PropertyKind::Init {
            return self.raw(property.span);
        }
        let value = match &property.value {
            Expression::ObjectExpression(object) => self.object(object),
            value => self.raw(value.span()),
        };
        let Some(layout) = self
            .properties
            .get(&(property.span.start, property.span.end))
        else {
            return format!("{}: {value}", property_key(property).unwrap());
        };
        let (key_span, value_span, computed, shorthand) =
            (layout.key, layout.value, layout.computed, layout.shorthand);
        if shorthand && !property.shorthand {
            return format!("{}: {value}", property_key(property).unwrap());
        }
        if property.shorthand {
            return self.raw(property.span);
        }
        let PropertyKey::StaticIdentifier(key) = &property.key else {
            return format!(
                "{}{value}",
                self.raw(Span::new(property.span.start, value_span.start))
            );
        };
        let mut before = self.raw(Span::new(property.span.start, key_span.start));
        let mut after = self.raw(Span::new(key_span.end, value_span.start));
        if computed && !property.computed {
            before = without_token(&before, b'[');
            after = without_token(&after, b']');
        }
        format!("{before}{}{after}{value}", key.name)
    }

    fn root(&mut self, root: &ObjectExpression<'_>) -> String {
        let mut code = self.object(root);
        // Comments attached to removed conflict properties have no surviving
        // node. Keep them at the end of the same config object as standalone
        // comments; retained nodes keep their original inline comments.
        let orphaned = self
            .comments
            .iter()
            .copied()
            .filter(|comment| {
                comment.start >= root.span.start
                    && comment.end <= root.span.end
                    && !self
                        .emitted_comments
                        .contains(&(comment.start, comment.end))
            })
            .collect::<Vec<_>>();
        if !orphaned.is_empty() {
            code.pop();
            code.push('\n');
            for comment in orphaned {
                code.push_str(&self.raw(comment));
                code.push('\n');
            }
            code.push('}');
        }
        code
    }
}

/// Gaps between parsed properties contain only trivia and one comma. Remove
/// that separator without touching comma characters inside either comment kind.
fn without_separator(raw: &str) -> String {
    without_token(raw, b',')
}

fn without_token(raw: &str, token: u8) -> String {
    let bytes = raw.as_bytes();
    let mut offset = 0;
    while offset < bytes.len() {
        if bytes[offset..].starts_with(b"/*") {
            offset += 2;
            while offset < bytes.len() && !bytes[offset..].starts_with(b"*/") {
                offset += 1;
            }
            offset = (offset + 2).min(bytes.len());
        } else if bytes[offset..].starts_with(b"//") {
            offset += 2;
            while offset < bytes.len() && !matches!(bytes[offset], b'\r' | b'\n') {
                offset += 1;
            }
        } else if bytes[offset] == token {
            let mut output = raw.to_string();
            output.remove(offset);
            return output;
        } else {
            offset += 1;
        }
    }
    raw.to_string()
}

fn property_key<'b>(property: &'b ObjectProperty<'_>) -> Option<&'b str> {
    match &property.key {
        PropertyKey::StaticIdentifier(identifier) if !property.computed => {
            Some(identifier.name.as_str())
        }
        PropertyKey::StringLiteral(literal) => Some(literal.value.as_str()),
        _ => None,
    }
}

fn find_property(object: &ObjectExpression<'_>, name: &str) -> Option<usize> {
    object.properties.iter().position(|property| {
        matches!(property, ObjectPropertyKind::ObjectProperty(property)
            if !property.method && property.kind == PropertyKind::Init && property_key(property) == Some(name))
    })
}

fn object_property<'b, 'a>(
    object: &'b mut ObjectExpression<'a>,
    name: &str,
) -> Option<&'b mut ObjectExpression<'a>> {
    let index = find_property(object, name)?;
    let ObjectPropertyKind::ObjectProperty(property) = &mut object.properties[index] else {
        return None;
    };
    let Expression::ObjectExpression(value) = &mut property.value else {
        return None;
    };
    Some(value)
}

fn record(changes: &mut Vec<String>, change: String) {
    if !changes.contains(&change) {
        changes.push(change);
    }
}

fn merge_properties<'a>(
    target: &mut ObjectExpression<'a>,
    source: &mut ObjectExpression<'a>,
) -> bool {
    let mut changed = false;
    for property in source.properties.drain(..) {
        let key = match &property {
            ObjectPropertyKind::ObjectProperty(property) => property_key(property),
            ObjectPropertyKind::SpreadProperty(_) => None,
        };
        if key.is_some_and(|key| find_property(target, key).is_some()) {
            continue;
        }
        target.properties.push(property);
        changed = true;
    }
    changed
}

fn move_property<'a>(
    object: &mut ObjectExpression<'a>,
    from: &'static str,
    to: &'static str,
    scope: &str,
    changes: &mut Vec<String>,
    builder: &AstBuilder<'a>,
) -> bool {
    let Some(source_index) = find_property(object, from) else {
        return false;
    };
    if find_property(object, to).is_none() {
        let ObjectPropertyKind::ObjectProperty(source) = &mut object.properties[source_index]
        else {
            unreachable!()
        };
        source.key = PropertyKey::new_static_identifier(source.key.span(), to, builder);
        source.computed = false;
        source.shorthand = false;
        record(changes, format!("{scope}.{from} -> {scope}.{to}"));
        return true;
    }

    let ObjectPropertyKind::ObjectProperty(mut source) = object.properties.remove(source_index)
    else {
        unreachable!()
    };
    if let (Expression::ObjectExpression(source), Some(target)) =
        (&mut source.value, object_property(object, to))
        && merge_properties(target, source)
    {
        record(changes, format!("{scope}.{from} merged into {scope}.{to}"));
    }
    record(
        changes,
        format!("{scope}.{from} removed (preferred {scope}.{to})"),
    );
    true
}

fn move_overwrite<'a>(
    object: &mut ObjectExpression<'a>,
    scope: &str,
    changes: &mut Vec<String>,
    builder: &AstBuilder<'a>,
) -> bool {
    let Some(_) = find_property(object, "overwrite") else {
        return false;
    };
    if find_property(object, "apply").is_none() {
        let value = Expression::new_object_expression(SPAN, ArenaVec::new_in(builder), builder);
        object
            .properties
            .push(ObjectPropertyKind::new_object_property(
                SPAN,
                PropertyKind::Init,
                PropertyKey::new_static_identifier(SPAN, "apply", builder),
                value,
                false,
                false,
                false,
                builder,
            ));
        record(changes, format!("{scope}.apply created"));
    }
    if object_property(object, "apply").is_none() {
        return false;
    }
    let overwrite_index = find_property(object, "overwrite").unwrap();
    let ObjectPropertyKind::ObjectProperty(mut overwrite) =
        object.properties.remove(overwrite_index)
    else {
        unreachable!()
    };
    let apply = object_property(object, "apply").unwrap();
    if find_property(apply, "overwrite").is_none() {
        overwrite.key =
            PropertyKey::new_static_identifier(overwrite.key.span(), "overwrite", builder);
        overwrite.computed = false;
        overwrite.shorthand = false;
        apply
            .properties
            .push(ObjectPropertyKind::ObjectProperty(overwrite));
        record(
            changes,
            format!("{scope}.overwrite -> {scope}.apply.overwrite"),
        );
    }
    true
}

fn migrate_options<'a>(
    object: &mut ObjectExpression<'a>,
    scope: &str,
    changes: &mut Vec<String>,
    builder: &AstBuilder<'a>,
) -> bool {
    let mut changed = false;
    for (from, to) in [
        ("cwd", "projectRoot"),
        ("tailwind", "tailwindcss"),
        ("features", "apply"),
        ("applyPatches", "apply"),
        ("output", "extract"),
    ] {
        changed = move_property(object, from, to, scope, changes, builder) || changed;
    }
    changed = move_overwrite(object, scope, changes, builder) || changed;
    for (parent, renames) in [
        (
            "extract",
            &[
                ("enabled", "write"),
                ("stripUniversalSelector", "removeUniversalSelector"),
            ][..],
        ),
        (
            "tailwindcss",
            &[
                ("package", "packageName"),
                ("legacy", "v2"),
                ("classic", "v3"),
                ("next", "v4"),
            ][..],
        ),
        ("apply", &[("exportContext", "exposeContext")][..]),
    ] {
        if let Some(child) = object_property(object, parent) {
            for (from, to) in renames {
                changed = move_property(child, from, to, scope, changes, builder) || changed;
            }
        }
    }
    changed
}

// Match the supported Babel wrapper set; do not expand identifiers or execute
// user functions while locating the config object.
fn unwrap_expression<'b, 'a>(mut expression: &'b mut Expression<'a>) -> &'b mut Expression<'a> {
    loop {
        expression = match expression {
            Expression::TSAsExpression(wrapper) => &mut wrapper.expression,
            Expression::TSSatisfiesExpression(wrapper) => &mut wrapper.expression,
            Expression::TSTypeAssertion(wrapper) => &mut wrapper.expression,
            Expression::ParenthesizedExpression(wrapper) => &mut wrapper.expression,
            _ => return expression,
        };
    }
}

fn resolve_expression<'b, 'a>(
    expression: &'b mut Expression<'a>,
) -> Option<&'b mut ObjectExpression<'a>> {
    match unwrap_expression(expression) {
        Expression::ObjectExpression(object) => Some(object),
        Expression::CallExpression(call) => {
            let expression = call.arguments.first_mut()?.as_expression_mut()?;
            match unwrap_expression(expression) {
                Expression::ObjectExpression(object) => Some(object),
                _ => None,
            }
        }
        _ => None,
    }
}

fn resolve_root<'b, 'a>(program: &'b mut Program<'a>) -> Option<&'b mut ObjectExpression<'a>> {
    let index = program
        .body
        .iter()
        .position(|statement| matches!(statement, Statement::ExportDefaultDeclaration(_)))?;
    let Statement::ExportDefaultDeclaration(export) = &program.body[index] else {
        unreachable!()
    };
    let identifier = match &export.declaration {
        ExportDefaultDeclarationKind::Identifier(identifier) => Some(identifier.name.to_string()),
        _ => None,
    };
    if let Some(name) = identifier {
        for statement in &mut program.body {
            let Statement::VariableDeclaration(variable) = statement else {
                continue;
            };
            for declaration in &mut variable.declarations {
                if matches!(&declaration.id, BindingPattern::BindingIdentifier(identifier) if identifier.name.as_str() == name)
                    && let Some(expression) = &mut declaration.init
                    && let Some(object) = resolve_expression(expression)
                {
                    return Some(object);
                }
            }
        }
        return None;
    }
    let Statement::ExportDefaultDeclaration(export) = &mut program.body[index] else {
        unreachable!()
    };
    resolve_expression(export.declaration.as_expression_mut()?)
}

#[napi]
pub fn migrate_config_source_native(source: String) -> napi::Result<ConfigSourceMigrationResult> {
    let allocator = Allocator::default();
    let mut parsed = Parser::new(&allocator, &source, SourceType::tsx()).parse();
    if parsed.panicked || !parsed.diagnostics.is_empty() {
        return Err(napi::Error::from_reason(format!(
            "Unable to parse config: {:?}",
            parsed.diagnostics
        )));
    }
    let semantics = SemanticBuilder::new()
        .with_check_syntax_error(true)
        .build(&parsed.program);
    if !semantics.diagnostics.is_empty() {
        return Err(napi::Error::from_reason(format!(
            "Unable to parse config: {:?}",
            semantics.diagnostics
        )));
    }
    drop(semantics);

    let unchanged = || ConfigSourceMigrationResult {
        changed: false,
        code: source.clone(),
        changes: Vec::new(),
    };
    let mut printer = SourcePrinter::new(&source, &parsed.program.comments);
    let Some(root) = resolve_root(&mut parsed.program) else {
        return Ok(unchanged());
    };
    printer.remember(root);
    let builder = AstBuilder::new(&allocator);
    let mut changes = Vec::new();
    let mut changed = false;
    for scope in ["registry", "patch"] {
        if let Some(options) = object_property(root, scope) {
            changed = migrate_options(options, scope, &mut changes, &builder) || changed;
        }
    }
    if [
        "cwd",
        "overwrite",
        "tailwind",
        "features",
        "output",
        "applyPatches",
    ]
    .iter()
    .any(|name| find_property(root, name).is_some())
    {
        changed = migrate_options(root, "root", &mut changes, &builder) || changed;
    }
    if !changed {
        return Ok(unchanged());
    }
    let replacement = printer.root(root);
    let mut code = source.clone();
    code.replace_range(
        root.span.start as usize..root.span.end as usize,
        &replacement,
    );
    Ok(ConfigSourceMigrationResult {
        changed,
        code,
        changes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handles_modern_precedence_and_preserves_change_order() {
        let result = migrate_config_source_native("export default { cwd: '.', projectRoot: './new', features: {exportContext:true}, apply:{overwrite:true}, overwrite:false, output:{enabled:false}, extract:{file:'classes.json'} }".into()).unwrap();
        assert!(result.changed);
        assert_eq!(
            result.changes,
            vec![
                "root.cwd removed (preferred root.projectRoot)",
                "root.features merged into root.apply",
                "root.features removed (preferred root.apply)",
                "root.output merged into root.extract",
                "root.output removed (preferred root.extract)",
                "root.enabled -> root.write",
                "root.exportContext -> root.exposeContext",
            ]
        );
        assert!(result.code.contains("projectRoot: './new'"));
        assert!(result.code.contains("overwrite:true"));
        assert!(result.code.contains("write:false"));
    }

    #[test]
    fn handles_typescript_wrappers_and_identifier_export() {
        let source = "const config = defineConfig(({registry:{['output']:{enabled:true}}} satisfies Config) as Config); export default config\n";
        let result = migrate_config_source_native(source.into()).unwrap();
        assert!(result.changed);
        assert!(result.code.contains("extract:"));
        assert!(result.code.contains("write:true"));
        assert!(result.code.contains("satisfies Config"));
        assert!(result.code.ends_with('\n'));
    }

    #[test]
    fn retains_comments_and_custom_expressions() {
        let source = "// config header\nexport default {\n// compatibility switches\nregistry: {\n/* extraction note */ output: { enabled: getEnabled(), /* file note */ file: `classes-${name}.json` },\n}, // registry end\n}\n// footer\n";
        let result = migrate_config_source_native(source.into()).unwrap();
        for comment in [
            "config header",
            "compatibility switches",
            "extraction note",
            "file note",
            "registry end",
            "footer",
        ] {
            assert!(
                result.code.contains(comment),
                "lost {comment}: {}",
                result.code
            );
        }
        assert!(result.code.contains("getEnabled()"));
        assert!(result.code.contains("`classes-${name}.json`"));
    }

    #[test]
    fn rejects_invalid_source_and_leaves_unresolved_configs_unchanged() {
        assert!(migrate_config_source_native("export default { registry:".into()).is_err());
        for source in [
            "const config = 123; export default config",
            "export default {apply:{exposeContext:true}}",
            "export default makeConfig(config)",
        ] {
            let result = migrate_config_source_native(source.into()).unwrap();
            assert!(!result.changed);
            assert_eq!(result.code, source);
            assert!(result.changes.is_empty());
        }
    }
}

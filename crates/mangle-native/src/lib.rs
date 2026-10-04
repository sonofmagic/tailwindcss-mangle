use napi_derive::napi;
use std::collections::{HashMap, HashSet};

pub mod cache;
pub mod css;
pub mod engine_source;
pub mod extraction;
pub mod filesystem;
pub mod html;
pub mod js;
pub mod migration;
pub mod patching;
pub mod text;

#[derive(Default)]
pub struct TransformContext {
    pub replacements: HashMap<String, String>,
    pub preserved: HashSet<String>,
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct Edit {
    pub start: u32,
    pub end: u32,
    pub content: String,
}

#[napi(object)]
#[derive(Debug)]
pub struct TransformResult {
    pub edits: Vec<Edit>,
    pub used: Vec<String>,
    pub preserved: Vec<String>,
    pub valid: bool,
}

impl Default for TransformResult {
    fn default() -> Self {
        Self {
            edits: vec![],
            used: vec![],
            preserved: vec![],
            valid: true,
        }
    }
}

impl TransformResult {
    // Usage and preservation are sets at the public Context boundary. Transfer
    // each name once per module instead of once per matching literal.
    fn compact(mut self) -> Self {
        let mut seen = HashSet::new();
        self.used.retain(|name| seen.insert(name.clone()));
        seen.clear();
        self.preserved.retain(|name| seen.insert(name.clone()));
        self
    }
}

#[napi(object)]
pub struct Replacement {
    pub original: String,
    pub replacement: String,
}

#[napi]
pub struct NativeContext {
    context: TransformContext,
}

#[napi]
impl NativeContext {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            context: TransformContext::default(),
        }
    }

    #[napi]
    pub fn reset(&mut self, replacements: Vec<Replacement>, preserved: Vec<String>) {
        self.context.replacements = replacements
            .into_iter()
            .map(|r| (r.original, r.replacement))
            .collect();
        self.context.preserved = preserved.into_iter().collect();
    }

    #[napi]
    pub fn update(&mut self, replacements: Vec<Replacement>) {
        for replacement in replacements {
            self.context
                .replacements
                .insert(replacement.original, replacement.replacement);
        }
    }

    #[napi]
    pub fn set_preserved(&mut self, preserved: Vec<String>) {
        self.context.preserved = preserved.into_iter().collect();
    }

    #[napi]
    pub fn transform_js(
        &self,
        source: String,
        preserve_functions: Vec<String>,
        split_quote: bool,
    ) -> TransformResult {
        js::transform(&source, &self.context, &preserve_functions, split_quote).compact()
    }

    #[napi]
    pub fn transform_css(&self, source: String, ignore_vue_scoped: bool) -> TransformResult {
        css::transform(&source, &self.context, ignore_vue_scoped)
    }

    #[napi]
    pub fn transform_html(&self, source: String) -> TransformResult {
        html::transform(&source, &self.context).compact()
    }

    #[napi]
    pub fn transform_selector(
        &self,
        source: String,
        ignore_vue_scoped: bool,
    ) -> css::SelectorResult {
        css::transform_selector(&source, &self.context, ignore_vue_scoped)
    }

    #[napi]
    pub fn transform_text(&self, source: String, split_quote: bool) -> TransformResult {
        let (content, used) = text::replace_tokens(&source, &self.context, split_quote);
        let edits = if content == source {
            vec![]
        } else {
            vec![Edit {
                start: 0,
                end: source.encode_utf16().count() as u32,
                content,
            }]
        };
        TransformResult {
            edits,
            used,
            ..Default::default()
        }
    }
}

impl Default for NativeContext {
    fn default() -> Self {
        Self::new()
    }
}

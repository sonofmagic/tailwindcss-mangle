use napi_derive::napi;
use std::collections::{HashMap, HashSet, VecDeque};

#[napi(object)]
#[derive(Clone)]
pub struct ExtractionCandidate {
    pub raw_candidate: String,
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
#[derive(Clone)]
pub struct ExtractionRange {
    pub start: u32,
    pub end: u32,
}

#[napi(object)]
pub struct ExtractionLineMeta {
    pub line: i32,
    pub column: i32,
    pub line_text: String,
}

#[napi(object)]
#[derive(Clone)]
pub struct ExtractionSegment {
    pub content: String,
    pub start: u32,
    pub joined_start: Option<u32>,
}

#[napi(object)]
pub struct ExtractionJoinedSegments {
    pub content: String,
    pub segments: Vec<ExtractionSegment>,
}

#[napi(object)]
pub struct ExtractionRemappedCandidate {
    pub raw_candidate: String,
    pub start: u32,
    pub end: u32,
    pub local_start: u32,
}

#[napi(object)]
#[derive(Clone)]
pub struct RawCandidateCacheEntry {
    pub fingerprint: String,
    pub candidates: Vec<String>,
}

#[napi]
pub struct NativeRawCandidateCache {
    entries: HashMap<String, RawCandidateCacheEntry>,
    order: VecDeque<String>,
    limit: usize,
}

#[napi]
impl NativeRawCandidateCache {
    #[napi(constructor)]
    pub fn new(limit: u32) -> Self {
        Self {
            entries: HashMap::new(),
            order: VecDeque::new(),
            limit: limit.max(1) as usize,
        }
    }

    #[napi]
    pub fn get(&mut self, key: String, fingerprint: String) -> Option<RawCandidateCacheEntry> {
        let entry = self.entries.get(&key)?;
        if entry.fingerprint != fingerprint {
            return None;
        }
        let entry = entry.clone();
        self.order.retain(|existing| existing != &key);
        self.order.push_back(key);
        Some(entry)
    }

    #[napi]
    pub fn set(&mut self, key: String, fingerprint: String, candidates: Vec<String>) {
        // Map.set keeps an existing entry's insertion order; cache hits move it to the tail.
        if !self.entries.contains_key(&key) {
            self.order.push_back(key.clone());
        }
        self.entries.insert(
            key,
            RawCandidateCacheEntry {
                fingerprint,
                candidates,
            },
        );
        while self.entries.len() > self.limit {
            if let Some(key) = self.order.pop_front() {
                self.entries.remove(&key);
            }
        }
    }
}

pub struct RawCandidateFingerprintTask {
    files: Vec<String>,
}

impl napi::Task for RawCandidateFingerprintTask {
    type Output = String;
    type JsValue = String;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        let mut entries: Vec<String> = self
            .files
            .iter()
            .map(|file| {
                let Ok(metadata) = std::fs::metadata(file) else {
                    return format!("{file}:missing");
                };
                let Ok(modified) = metadata.modified() else {
                    return format!("{file}:missing");
                };
                let milliseconds = match modified.duration_since(std::time::UNIX_EPOCH) {
                    Ok(duration) => {
                        duration.as_secs() as f64 * 1000.0
                            + duration.subsec_nanos() as f64 / 1_000_000.0
                    }
                    Err(error) => {
                        -(error.duration().as_secs() as f64 * 1000.0
                            + error.duration().subsec_nanos() as f64 / 1_000_000.0)
                    }
                };
                format!("{file}:{}:{milliseconds}", metadata.len())
            })
            .collect();
        entries.sort_by(|left, right| left.encode_utf16().cmp(right.encode_utf16()));
        Ok(entries.join("|"))
    }

    fn resolve(&mut self, _env: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi(ts_return_type = "Promise<string>")]
pub fn create_raw_candidate_file_fingerprint_native(
    files: Vec<String>,
) -> napi::bindgen_prelude::AsyncTask<RawCandidateFingerprintTask> {
    napi::bindgen_prelude::AsyncTask::new(RawCandidateFingerprintTask { files })
}

#[napi(object)]
pub struct InlineSourceCandidates {
    pub included: Vec<String>,
    pub excluded: Vec<String>,
}

#[napi(object)]
#[derive(Clone)]
pub struct NativeSourcePattern {
    pub base: String,
    pub pattern: String,
    pub negated: bool,
}

#[napi(object)]
pub struct NativeSourceGroup {
    pub base: String,
    pub entries: Vec<NativeSourcePattern>,
}

#[napi(object)]
pub struct NativeStaticGlobPrefix {
    pub prefix: Vec<String>,
    pub rest: Vec<String>,
}

fn normalize_glob(pattern: &str) -> &str {
    pattern.strip_prefix("./").unwrap_or(pattern)
}

#[napi]
pub fn normalize_glob_pattern_native(pattern: String) -> String {
    normalize_glob(&pattern).to_owned()
}

#[napi]
pub fn split_static_glob_prefix_native(pattern: String) -> NativeStaticGlobPrefix {
    static SEPARATORS: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let separators = SEPARATORS.get_or_init(|| regex::Regex::new(r"[\\/]+").unwrap());
    let mut prefix = Vec::new();
    let mut rest = Vec::new();
    let mut reached_glob = false;
    for segment in separators.split(normalize_glob(&pattern)) {
        if !reached_glob
            && !segment.is_empty()
            && !segment.chars().any(|c| "*?[]{}()!+@".contains(c))
        {
            prefix.push(segment.to_owned());
        } else {
            reached_glob = true;
            rest.push(segment.to_owned());
        }
    }
    NativeStaticGlobPrefix { prefix, rest }
}

fn expand_source_braces(pattern: &str) -> Vec<String> {
    let Some(open) = pattern.find('{') else {
        return vec![pattern.to_owned()];
    };
    let rest = &pattern[open..];
    let bytes = rest.as_bytes();
    let mut depth = 0;
    let mut close = None;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' {
            i += 2;
            continue;
        }
        if bytes[i] == b'{' {
            depth += 1;
        } else if bytes[i] == b'}' {
            depth -= 1;
            if depth == 0 {
                close = Some(i);
                break;
            }
        }
        i += 1;
    }
    let Some(close) = close else {
        return vec![pattern.to_owned()];
    };
    let inner = &rest[1..close];
    let bytes = inner.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut depth: usize = 0;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'\\' {
            i += 2;
            continue;
        }
        if bytes[i] == b'{' {
            depth += 1;
        } else if bytes[i] == b'}' {
            depth = depth.saturating_sub(1);
        } else if bytes[i] == b',' && depth == 0 {
            parts.push(&inner[start..i]);
            start = i + 1;
        }
        i += 1;
    }
    parts.push(&inner[start..]);
    parts
        .into_iter()
        .flat_map(|part| {
            expand_source_braces(&format!("{}{part}{}", &pattern[..open], &rest[close + 1..]))
        })
        .collect()
}

#[napi]
pub fn expand_source_entry_braces_native(
    sources: Vec<NativeSourcePattern>,
) -> Vec<NativeSourcePattern> {
    sources
        .into_iter()
        .flat_map(|source| {
            expand_source_braces(&source.pattern)
                .into_iter()
                .map(move |pattern| NativeSourcePattern {
                    base: source.base.clone(),
                    negated: source.negated,
                    pattern,
                })
        })
        .collect()
}

#[napi]
pub fn group_source_entries_native(sources: Vec<NativeSourcePattern>) -> Vec<NativeSourceGroup> {
    let mut groups: Vec<NativeSourceGroup> = Vec::new();
    let mut by_base = HashMap::new();
    for source in sources {
        let source = NativeSourcePattern {
            pattern: normalize_glob(&source.pattern).to_owned(),
            ..source
        };
        let index = *by_base.entry(source.base.clone()).or_insert_with(|| {
            groups.push(NativeSourceGroup {
                base: source.base.clone(),
                entries: Vec::new(),
            });
            groups.len() - 1
        });
        groups[index].entries.push(source);
    }
    groups
}

#[napi]
pub fn merge_source_entries_native(sources: Vec<NativeSourcePattern>) -> Vec<NativeSourcePattern> {
    let mut seen = HashSet::new();
    sources
        .into_iter()
        .map(|source| NativeSourcePattern {
            pattern: normalize_glob(&source.pattern).to_owned(),
            ..source
        })
        .filter(|source| seen.insert((source.base.clone(), source.pattern.clone(), source.negated)))
        .collect()
}

#[napi]
pub fn unique_strings_native(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .filter(|value| seen.insert(value.clone()))
        .collect()
}

fn trim_js(value: &str) -> &str {
    value.trim_matches(|character: char| character.len_utf16() == 1 && whitespace(character as u16))
}

fn split_top_level(value: &str, separator: u16, keep_empty: bool) -> Vec<String> {
    let value = utf16(value);
    let mut result = Vec::new();
    let mut start = 0;
    let mut depth: usize = 0;
    let mut quote = None;
    let mut i = 0;
    while i < value.len() {
        let c = value[i];
        if c == 92 {
            i += 2;
            continue;
        }
        if let Some(q) = quote {
            if q == c {
                quote = None;
            }
        } else if matches!(c, 34 | 39) {
            quote = Some(c);
        } else if matches!(c, 40 | 91 | 123) {
            depth += 1;
        } else if matches!(c, 41 | 93 | 125) {
            depth = depth.saturating_sub(1);
        } else if depth == 0 && c == separator {
            let item = string(&value[start..i]);
            let item = trim_js(&item);
            if !item.is_empty() || keep_empty {
                result.push(item.to_owned());
            }
            start = i + 1;
        }
        i += 1;
    }
    let item = string(&value[start..]);
    let item = trim_js(&item);
    if !item.is_empty() || keep_empty {
        result.push(item.to_owned());
    }
    result
}

fn expand_inline_pattern(pattern: &str) -> napi::Result<Vec<String>> {
    let Some(open) = pattern.find('{') else {
        return Ok(vec![pattern.to_owned()]);
    };
    let prefix = &pattern[..open];
    let rest = &pattern[open..];
    let mut depth = 0;
    let mut close = None;
    for (i, c) in rest.bytes().enumerate() {
        if c == b'{' {
            depth += 1;
        } else if c == b'}' {
            depth -= 1;
            if depth == 0 {
                close = Some(i);
                break;
            }
        }
    }
    let close = close.ok_or_else(|| {
        napi::Error::from_reason(format!(
            "The Tailwind CSS v4 inline source pattern \"{pattern}\" is not balanced."
        ))
    })?;
    let body = &rest[1..close];
    static SEQUENCE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    let sequence = SEQUENCE
        .get_or_init(|| regex::Regex::new(r"^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$").unwrap());
    let parts = if let Some(captures) = sequence.captures(body) {
        let start: f64 = captures[1].parse().unwrap();
        let end: f64 = captures[2].parse().unwrap();
        let mut step: f64 = captures
            .get(3)
            .map(|value| value.as_str().parse().unwrap())
            .unwrap_or(if start <= end { 1.0 } else { -1.0 });
        if step == 0.0 {
            return Err(napi::Error::from_reason(
                "Step cannot be zero in Tailwind CSS v4 inline source sequence.",
            ));
        }
        let ascending = start < end;
        if (ascending && step < 0.0) || (!ascending && step > 0.0) {
            step = -step;
        }
        let mut parts = Vec::new();
        let mut current = start;
        while if ascending {
            current <= end
        } else {
            current >= end
        } {
            parts.push(if current == 0.0 {
                "0".into()
            } else {
                current.to_string()
            });
            let next = current + step;
            if !next.is_finite() || next == current {
                return Err(napi::Error::from_reason(
                    "Inline source sequence cannot make numeric progress.",
                ));
            }
            current = next;
        }
        parts
    } else {
        let mut parts = Vec::new();
        for part in split_top_level(body, 44, true) {
            parts.extend(expand_inline_pattern(&part)?);
        }
        parts
    };
    let suffixes = expand_inline_pattern(&rest[close + 1..])?;
    let mut result = Vec::new();
    for part in parts {
        for suffix in &suffixes {
            result.push(format!("{prefix}{part}{suffix}"));
        }
    }
    Ok(result)
}

fn unquote_css(value: &str) -> Option<String> {
    let value = utf16(value);
    if !value.first().is_some_and(|c| matches!(c, 34 | 39)) || value.first() != value.last() {
        return None;
    }
    let mut result = Vec::new();
    let mut i = 1;
    while i + 1 < value.len() {
        if value[i] == 92 {
            i += 1;
        }
        if let Some(c) = value.get(i) {
            result.push(*c);
        }
        i += 1;
    }
    Some(string(&result))
}

struct SourceRulesParser<'s> {
    source: &'s str,
    params: Vec<String>,
    valid: bool,
}

impl SourceRulesParser<'_> {
    fn body(&mut self, input: &mut cssparser::Parser<'_>) {
        let mut valid = true;
        for item in cssparser::RuleBodyParser::new(input, self) {
            valid = item.is_ok() && valid;
        }
        self.valid &= valid;
    }

    fn block(&mut self, input: &mut cssparser::Parser<'_>) {
        self.body(input);
        self.valid &= self.source.as_bytes().get(input.position().byte_index()) == Some(&b'}');
    }
}

impl<'i> cssparser::DeclarationParser<'i> for SourceRulesParser<'_> {
    type Declaration = ();
    type Error = ();

    fn parse_value(
        &mut self,
        name: cssparser::CowRcStr<'i>,
        input: &mut cssparser::Parser<'i>,
        _start: &cssparser::ParserState,
    ) -> Result<(), cssparser::ParseError<()>> {
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            if token.is_parse_error()
                || matches!(token, cssparser::Token::CurlyBracketBlock) && !name.starts_with("--")
            {
                return Err(cssparser::ParseError::unexpected_token());
            }
        }
        Ok(())
    }
}

impl<'i> cssparser::AtRuleParser<'i> for SourceRulesParser<'_> {
    type Prelude = ();
    type AtRule = ();
    type Error = ();

    fn parse_prelude(
        &mut self,
        name: cssparser::CowRcStr<'i>,
        input: &mut cssparser::Parser<'i>,
    ) -> Result<(), cssparser::ParseError<()>> {
        let start = input.position();
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            if token.is_parse_error() {
                return Err(cssparser::ParseError::unexpected_token());
            }
        }
        if name == "source" {
            self.params.push(input.slice_from(start).to_owned());
        }
        Ok(())
    }

    fn rule_without_block(
        &mut self,
        _prelude: (),
        _start: &cssparser::ParserState,
    ) -> Result<(), ()> {
        Ok(())
    }

    fn parse_block(
        &mut self,
        _prelude: (),
        _start: &cssparser::ParserState,
        input: &mut cssparser::Parser<'i>,
    ) -> Result<(), cssparser::ParseError<()>> {
        self.block(input);
        Ok(())
    }
}

impl<'i> cssparser::QualifiedRuleParser<'i> for SourceRulesParser<'_> {
    type Prelude = ();
    type QualifiedRule = ();
    type Error = ();

    fn parse_prelude(
        &mut self,
        input: &mut cssparser::Parser<'i>,
    ) -> Result<(), cssparser::ParseError<()>> {
        while let Ok(token) = input.next_including_whitespace_and_comments() {
            if token.is_parse_error() {
                return Err(cssparser::ParseError::unexpected_token());
            }
        }
        Ok(())
    }

    fn parse_block(
        &mut self,
        _prelude: (),
        _start: &cssparser::ParserState,
        input: &mut cssparser::Parser<'i>,
    ) -> Result<(), cssparser::ParseError<()>> {
        self.block(input);
        Ok(())
    }
}

impl<'i> cssparser::RuleBodyItemParser<'i, (), ()> for SourceRulesParser<'_> {
    fn parse_declarations(&self) -> bool {
        true
    }
    fn parse_qualified(&self) -> bool {
        true
    }
}

#[napi]
pub fn extract_inline_source_candidates_native(
    css: String,
) -> napi::Result<InlineSourceCandidates> {
    let mut comments = cssparser::Parser::new(&css);
    while let Ok(token) = comments.next_including_whitespace_and_comments().cloned() {
        if matches!(token, cssparser::Token::Comment(_)) {
            let end = comments.position().byte_index();
            if !css[..end].ends_with("*/") {
                return Err(napi::Error::from_reason(
                    "Unable to parse Tailwind CSS inline sources.",
                ));
            }
        }
    }
    let mut parser = SourceRulesParser {
        source: &css,
        params: Vec::new(),
        valid: true,
    };
    parser.body(&mut cssparser::Parser::new(&css));
    if !parser.valid {
        return Err(napi::Error::from_reason(
            "Unable to parse Tailwind CSS inline sources.",
        ));
    }
    let mut included = Vec::new();
    let mut excluded = Vec::new();
    let mut seen_included = HashSet::new();
    let mut seen_excluded = HashSet::new();
    for params in parser.params {
        let params = trim_js(&params);
        let (negated, params) = if let Some(rest) = params.strip_prefix("not ") {
            (true, trim_js(rest))
        } else {
            (false, params)
        };
        let Some(value) = params
            .strip_prefix("inline(")
            .and_then(|value| value.strip_suffix(')'))
            .and_then(|value| unquote_css(trim_js(value)))
        else {
            continue;
        };
        let (target, seen) = if negated {
            (&mut excluded, &mut seen_excluded)
        } else {
            (&mut included, &mut seen_included)
        };
        for part in split_top_level(&value, 32, false) {
            for candidate in expand_inline_pattern(&part)? {
                if seen.insert(candidate.clone()) {
                    target.push(candidate);
                }
            }
        }
    }
    Ok(InlineSourceCandidates { included, excluded })
}

fn utf16(value: &str) -> Vec<u16> {
    value.encode_utf16().collect()
}

fn string(value: &[u16]) -> String {
    String::from_utf16_lossy(value)
}

fn whitespace(c: u16) -> bool {
    matches!(c, 0x0009..=0x000d | 0x0020 | 0x00a0 | 0x1680 | 0x2000..=0x200a | 0x2028..=0x2029 | 0x202f | 0x205f | 0x3000 | 0xfeff)
}

fn html_whitespace(c: u16) -> bool {
    matches!(c, 9 | 10 | 12 | 13 | 32)
}

fn valid_token(value: &[u16]) -> bool {
    value
        .iter()
        .any(|c| matches!(c, 48..=57 | 65..=90 | 97..=122 | 95 | 160..=65535 | 37..=63))
}

fn normalized_whitespace(value: &[u16]) -> Vec<u16> {
    let mut result = Vec::with_capacity(value.len());
    let mut i = 0;
    while i < value.len() {
        if value[i] == 92
            && value
                .get(i + 1)
                .is_some_and(|c| matches!(c, 110 | 114 | 116))
        {
            result.push(32);
            i += 2;
        } else {
            result.push(value[i]);
            i += 1;
        }
    }
    result
}

fn closing_quote(value: &[u16], mut i: usize, quote: u16) -> bool {
    while i < value.len() {
        if value[i] == 92 {
            i += 2;
            continue;
        }
        if value[i] == quote {
            return value[i + 1..].contains(&93);
        }
        i += 1;
    }
    false
}

#[napi]
pub fn split_candidate_tokens_native(code: String) -> Vec<String> {
    let code = normalized_whitespace(&utf16(&code));
    let mut result = Vec::new();
    let mut depth: usize = 0;
    let mut quote = None;
    let mut start = 0;
    let mut i = 0;
    while i < code.len() {
        let c = code[i];
        if depth > 0 && c == 92 {
            i += 2;
            continue;
        }
        if depth > 0 && matches!(c, 34 | 39) {
            if quote == Some(c) {
                quote = None;
            } else if quote.is_none() && closing_quote(&code, i + 1, c) {
                quote = Some(c);
            }
        }
        if quote.is_none() {
            if c == 91 && code[i + 1..].contains(&93) {
                depth += 1;
            } else if c == 93 {
                depth = depth.saturating_sub(1);
            }
        }
        if depth == 0 && (c == 34 || whitespace(c)) {
            if valid_token(&code[start..i]) {
                result.push(string(&code[start..i]));
            }
            start = i + 1;
        }
        i += 1;
    }
    if valid_token(&code[start..]) {
        result.push(string(&code[start..]));
    }
    result
}

fn skip_quote(content: &[u16], mut i: usize, quote: u16) -> usize {
    i += 1;
    while i < content.len() {
        if content[i] == 92 {
            i += 2;
        } else if content[i] == quote {
            return i + 1;
        } else {
            i += 1;
        }
    }
    i
}

fn string_ranges(content: &[u16]) -> Vec<ExtractionRange> {
    let mut ranges = Vec::new();
    let mut quote = None;
    let mut start = 0;
    let mut depth = 0;
    let mut i = 0;
    while i < content.len() {
        let c = content[i];
        if quote.is_some() && c == 92 {
            i += 2;
            continue;
        }
        if quote == Some(96) && depth > 0 {
            if matches!(c, 34 | 39 | 96) {
                i = skip_quote(content, i, c);
                continue;
            }
            if c == 123 {
                depth += 1;
            } else if c == 125 {
                depth -= 1;
            }
            i += 1;
            continue;
        }
        if let Some(q) = quote {
            if q == 96 && c == 36 && content.get(i + 1) == Some(&123) {
                ranges.push(ExtractionRange {
                    start,
                    end: i as u32,
                });
                depth = 1;
                i += 2;
                continue;
            }
            if c == q {
                ranges.push(ExtractionRange {
                    start,
                    end: i as u32,
                });
                quote = None;
            }
        } else if matches!(c, 34 | 39 | 96) {
            quote = Some(c);
            start = (i + 1) as u32;
        }
        i += 1;
    }
    if quote.is_some() && depth == 0 {
        ranges.push(ExtractionRange {
            start,
            end: content.len() as u32,
        });
    }
    ranges
}

#[napi]
pub fn create_js_string_static_ranges_native(content: String) -> Vec<ExtractionRange> {
    string_ranges(&utf16(&content))
}

fn inside_ranges(ranges: &[ExtractionRange], start: u32) -> bool {
    let mut low = 0;
    let mut high = ranges.len();
    while low < high {
        let mid = (low + high - 1) / 2;
        let range = &ranges[mid];
        if start < range.start {
            high = mid;
        } else if start >= range.end {
            low = mid + 1;
        } else {
            return true;
        }
    }
    false
}

fn css_extension(extension: &str) -> bool {
    matches!(
        extension,
        "css"
            | "wxss"
            | "acss"
            | "jxss"
            | "ttss"
            | "qss"
            | "tyss"
            | "scss"
            | "sass"
            | "less"
            | "styl"
            | "stylus"
    )
}

fn js_extension(extension: &str) -> bool {
    let extension = extension
        .strip_prefix('c')
        .or_else(|| extension.strip_prefix('m'))
        .unwrap_or(extension);
    matches!(extension, "js" | "jsx" | "ts" | "tsx")
}

fn next_char(content: &[u16], c: u16, start: usize) -> Option<usize> {
    content
        .get(start..)
        .and_then(|value| value.iter().position(|value| *value == c))
        .map(|offset| start + offset)
}

#[napi]
pub fn filter_source_candidate_indexes_native(
    content: String,
    extension: String,
    candidates: Vec<ExtractionCandidate>,
    skip_html_context_checks: Option<bool>,
    ranges: Option<Vec<ExtractionRange>>,
) -> Vec<u32> {
    let content = utf16(&content);
    let is_js = js_extension(&extension);
    let opens: Vec<usize> = content
        .iter()
        .enumerate()
        .filter_map(|(i, c)| (*c == 60).then_some(i))
        .collect();
    let closes: Vec<usize> = content
        .iter()
        .enumerate()
        .filter_map(|(i, c)| (*c == 62).then_some(i))
        .collect();
    let applies: Vec<usize> = if css_extension(&extension) {
        content
            .windows(6)
            .enumerate()
            .filter_map(|(i, text)| (text == [64, 97, 112, 112, 108, 121]).then_some(i))
            .collect()
    } else {
        Vec::new()
    };
    let css_boundaries: Vec<usize> = if css_extension(&extension) {
        content
            .iter()
            .enumerate()
            .filter_map(|(i, c)| matches!(c, 59 | 123 | 125).then_some(i))
            .collect()
    } else {
        Vec::new()
    };
    let ranges = if is_js {
        ranges.unwrap_or_else(|| string_ranges(&content))
    } else {
        Vec::new()
    };
    candidates
        .iter()
        .enumerate()
        .filter_map(|(i, candidate)| {
            if candidate.raw_candidate.is_empty()
                || matches!(
                    candidate.raw_candidate.as_str(),
                    "!important"
                        | "@apply"
                        | "@tailwind"
                        | "@source"
                        | "@config"
                        | "@plugin"
                        | "@theme"
                        | "@utility"
                        | "@custom-variant"
                        | "@variant"
                )
            {
                return None;
            }
            let start = candidate.start as usize;
            let end = candidate.end as usize;
            if css_extension(&extension) {
                let apply = applies
                    .partition_point(|position| *position <= start)
                    .checked_sub(1)
                    .map(|index| applies[index])?;
                let boundary_index =
                    css_boundaries.partition_point(|position| *position < apply + 6);
                if css_boundaries
                    .get(boundary_index)
                    .is_some_and(|position| *position < start)
                {
                    return None;
                }
            }
            if !skip_html_context_checks.unwrap_or(false) {
                if matches!(
                    candidate.raw_candidate.as_str(),
                    "class" | "className" | "hover-class" | "hoverClass"
                ) {
                    let mut after = end;
                    while content.get(after).is_some_and(|c| html_whitespace(*c)) {
                        after += 1;
                    }
                    if content.get(after) == Some(&61) {
                        return None;
                    }
                }
                let open = opens
                    .partition_point(|position| *position <= start)
                    .checked_sub(1)
                    .map(|index| opens[index]);
                let close = closes
                    .partition_point(|position| *position <= start)
                    .checked_sub(1)
                    .map(|index| closes[index]);
                if open <= close
                    && let Some(next_open) =
                        opens.get(opens.partition_point(|position| *position < end))
                    && closes
                        .get(closes.partition_point(|position| *position < end))
                        .is_none_or(|next_close| next_open < next_close)
                {
                    return None;
                }
            }
            if is_js && !inside_ranges(&ranges, candidate.start) {
                return None;
            }
            Some(i as u32)
        })
        .collect()
}

#[napi]
pub fn dedupe_candidates_native(candidates: Vec<ExtractionCandidate>) -> Vec<ExtractionCandidate> {
    let mut seen = HashSet::with_capacity(candidates.len());
    candidates
        .into_iter()
        .filter(|candidate| {
            seen.insert((
                candidate.start,
                candidate.end,
                candidate.raw_candidate.clone(),
            ))
        })
        .collect()
}

fn line_offsets(content: &[u16]) -> Vec<u32> {
    let mut offsets = vec![0];
    for (i, c) in content.iter().enumerate() {
        if *c == 10 {
            offsets.push((i + 1) as u32);
        }
    }
    if offsets.last() != Some(&(content.len() as u32)) {
        offsets.push(content.len() as u32);
    }
    offsets
}

#[napi]
pub fn build_line_offsets_native(content: String) -> Vec<u32> {
    line_offsets(&utf16(&content))
}

fn line_meta(content: &[u16], offsets: &[Option<u32>], index: u32) -> ExtractionLineMeta {
    let mut low = 0;
    let mut high = offsets.len();
    while low < high {
        let mid = (low + high - 1) / 2;
        let Some(start) = offsets[mid] else {
            break;
        };
        let next = offsets
            .get(mid + 1)
            .copied()
            .flatten()
            .unwrap_or(content.len() as u32);
        if index < start {
            high = mid;
        } else if index >= next {
            low = mid + 1;
        } else {
            let start_index = (start as usize).min(content.len());
            let end = next_char(content, 10, start_index).unwrap_or(content.len());
            return ExtractionLineMeta {
                line: mid as i32 + 1,
                column: index as i32 - start as i32 + 1,
                line_text: string(&content[start_index..end]),
            };
        }
    }
    let start = offsets
        .len()
        .checked_sub(2)
        .and_then(|i| offsets.get(i))
        .copied()
        .flatten()
        .unwrap_or(0);
    ExtractionLineMeta {
        line: offsets.len() as i32 - 1,
        column: index as i32 - start as i32 + 1,
        line_text: string(&content[(start as usize).min(content.len())..]),
    }
}

#[napi]
pub fn resolve_line_meta_native(
    content: String,
    offsets: Vec<Option<u32>>,
    index: u32,
) -> ExtractionLineMeta {
    line_meta(&utf16(&content), &offsets, index)
}

#[napi]
pub fn resolve_line_metas_native(content: String, positions: Vec<u32>) -> Vec<ExtractionLineMeta> {
    let content = utf16(&content);
    let offsets: Vec<_> = line_offsets(&content).into_iter().map(Some).collect();
    positions
        .into_iter()
        .map(|index| line_meta(&content, &offsets, index))
        .collect()
}

#[napi]
pub fn join_source_segments_native(segments: Vec<ExtractionSegment>) -> ExtractionJoinedSegments {
    let mut content = String::new();
    let mut joined_start = 0;
    let segments = segments
        .into_iter()
        .enumerate()
        .map(|(i, segment)| {
            if i > 0 {
                content.push('\n');
                joined_start += 1;
            }
            let segment = ExtractionSegment {
                joined_start: Some(joined_start),
                ..segment
            };
            content.push_str(&segment.content);
            joined_start += segment.content.encode_utf16().count() as u32;
            segment
        })
        .collect();
    ExtractionJoinedSegments { content, segments }
}

#[napi]
pub fn remap_source_candidates_native(
    segments: Vec<ExtractionSegment>,
    candidates: Vec<ExtractionCandidate>,
) -> Vec<ExtractionRemappedCandidate> {
    candidates
        .into_iter()
        .filter_map(|candidate| {
            let index = segments
                .partition_point(|segment| segment.joined_start.unwrap_or(0) <= candidate.start)
                .checked_sub(1)?;
            let segment = &segments[index];
            let joined_start = segment.joined_start.unwrap_or(0);
            let joined_end = joined_start + segment.content.encode_utf16().count() as u32;
            if candidate.start >= joined_end || candidate.end > joined_end {
                return None;
            }
            let start = segment.start + candidate.start - joined_start;
            Some(ExtractionRemappedCandidate {
                end: start + candidate.raw_candidate.encode_utf16().count() as u32,
                start,
                local_start: candidate.start,
                raw_candidate: candidate.raw_candidate,
            })
        })
        .collect()
}

fn escaped(value: &[u16], index: usize) -> bool {
    value[..index]
        .iter()
        .rev()
        .take_while(|c| **c == 92)
        .count()
        % 2
        == 1
}

fn split_variant(value: &[u16]) -> usize {
    let mut depth: usize = 0;
    let mut quote = None;
    let mut separator = 0;
    let mut i = 0;
    while i < value.len() {
        let c = value[i];
        if c == 92 {
            i += 2;
            continue;
        }
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
        } else if matches!(c, 34 | 39) {
            quote = Some(c);
        } else if matches!(c, 91 | 40 | 123) {
            depth += 1;
        } else if matches!(c, 93 | 41 | 125) {
            depth = depth.saturating_sub(1);
        } else if depth == 0 && c == 58 {
            separator = i + 1;
        }
        i += 1;
    }
    separator
}

fn balanced(value: &[u16], braces: bool) -> bool {
    let mut depth = 0_i32;
    let mut quote = None;
    let mut i = 0;
    while i < value.len() {
        let c = value[i];
        if escaped(value, i) {
            i += 1;
            continue;
        }
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
        } else if matches!(c, 34 | 39) {
            quote = Some(c);
        } else if c == 40 || (braces && c == 123) {
            depth += 1;
        } else if c == 41 || (braces && c == 125) {
            depth -= 1;
            if depth < 0 {
                return false;
            }
        }
        i += 1;
    }
    depth == 0 && quote.is_none()
}

fn normalize_escaped(value: &[u16]) -> napi::Result<Vec<u16>> {
    let mut result = Vec::with_capacity(value.len());
    let mut i = 0;
    while i < value.len() {
        if value[i] != 92 || i + 1 == value.len() {
            result.push(value[i]);
            i += 1;
            continue;
        }
        let next = value[i + 1];
        if (next as u8).is_ascii_hexdigit() && next <= 127 {
            let mut number = 0;
            let mut digits = 0;
            i += 1;
            while i < value.len() && digits < 6 {
                let c = value[i];
                if c > 127 || !(c as u8).is_ascii_hexdigit() {
                    break;
                }
                number = number * 16 + (c as u8 as char).to_digit(16).unwrap();
                digits += 1;
                i += 1;
            }
            if value.get(i).is_some_and(|c| html_whitespace(*c)) {
                i += 1;
            }
            if number > 0x10ffff {
                return Err(napi::Error::from_reason("Invalid code point"));
            }
            if number == 95 {
                result.push(92);
            }
            if number <= 0xffff {
                result.push(number as u16);
            } else {
                let number = number - 0x10000;
                result.push(0xd800 + (number >> 10) as u16);
                result.push(0xdc00 + (number & 1023) as u16);
            }
        } else {
            if next == 95 {
                result.push(92);
            }
            result.push(next);
            i += 2;
        }
    }
    Ok(result)
}

fn number(value: &str) -> bool {
    let value = value.strip_prefix('-').unwrap_or(value);
    let Some((before, after)) = value.split_once('.') else {
        return !value.is_empty() && value.bytes().all(|c| c.is_ascii_digit());
    };
    !after.is_empty()
        && before.bytes().all(|c| c.is_ascii_digit())
        && after.bytes().all(|c| c.is_ascii_digit())
}

fn arbitrary_value(utility: &str, body: &[u16], units: &[String]) -> napi::Result<Option<String>> {
    let normalized = normalize_escaped(body)?;
    let value = string(&normalized);
    let twice_normalized = string(&normalize_escaped(&normalized)?);
    for unit in units {
        if let Some(prefix) = twice_normalized.strip_suffix(unit)
            && number(prefix)
        {
            return Ok(Some(format!("{prefix}{unit}")));
        }
    }
    if utility == "aspect"
        && let Some((a, b)) = value.split_once('/')
        && !a.is_empty()
        && !b.is_empty()
        && a.bytes().all(|c| c.is_ascii_digit())
        && b.bytes().all(|c| c.is_ascii_digit())
    {
        return Ok(Some(value));
    }
    if let Some(hex) = value.strip_prefix('#')
        && matches!(hex.len(), 3 | 4 | 6 | 7 | 8)
        && hex.bytes().all(|c| c.is_ascii_hexdigit())
    {
        return Ok(Some(value));
    }
    if normalized.first().is_some_and(|c| matches!(c, 34 | 39))
        && normalized.first() == normalized.last()
    {
        let mut is_escaped = false;
        for c in normalized
            .iter()
            .skip(1)
            .take(normalized.len().saturating_sub(2))
        {
            if is_escaped {
                is_escaped = false;
            } else if *c == 92 {
                is_escaped = true;
            }
        }
        if !is_escaped {
            return Ok(Some(value));
        }
    }
    let bytes = value.as_bytes();
    let valid_first = bytes
        .first()
        .is_some_and(|c| c.is_ascii_alphabetic() || matches!(c, b'_' | b'-'));
    let function_end = bytes.iter().position(|c| *c == b'(');
    if valid_first
        && function_end.is_some_and(|end| {
            bytes[1..end]
                .iter()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'_' | b'-'))
        })
        && value.ends_with(')')
        && balanced(&normalized, false)
    {
        return Ok(Some(
            if utility == "text"
                && value
                    .get(..4)
                    .is_some_and(|prefix| prefix.eq_ignore_ascii_case("var("))
            {
                format!("color:{value}")
            } else {
                value
            },
        ));
    }
    Ok(None)
}

fn resolve_bare(candidate: &str, units: &[String]) -> napi::Result<Option<String>> {
    if units.is_empty() || candidate.is_empty() || candidate.contains(['[', ']']) {
        return Ok(None);
    }
    let value = utf16(candidate);
    let prefix_end = split_variant(&value);
    let mut body_start = prefix_end;
    if value.get(body_start) == Some(&33) {
        body_start += 1;
    }
    if value.get(body_start) == Some(&45) {
        body_start += 1;
    }
    let body = &value[body_start..];
    if !balanced(body, true) {
        return Ok(None);
    }
    let mut depth: usize = 0;
    let mut quote = None;
    for i in (1..body.len()).rev() {
        let c = body[i];
        if escaped(body, i) {
            continue;
        }
        if let Some(q) = quote {
            if q == c {
                quote = None;
            }
            continue;
        }
        if matches!(c, 34 | 39) {
            quote = Some(c);
            continue;
        }
        if matches!(c, 41 | 125) {
            depth += 1;
            continue;
        }
        if matches!(c, 40 | 123) {
            depth = depth.saturating_sub(1);
            continue;
        }
        if depth > 0 || c != 45 || i + 1 == body.len() {
            continue;
        }
        let utility = string(&body[..i]);
        if let Some(arbitrary) = arbitrary_value(&utility, &body[i + 1..], units)? {
            return Ok(Some(format!(
                "{}{utility}-[{arbitrary}]",
                string(&value[..body_start])
            )));
        }
    }
    Ok(None)
}

#[napi]
pub fn resolve_bare_arbitrary_candidates_native(
    candidates: Vec<String>,
    units: Vec<String>,
) -> napi::Result<Vec<Option<String>>> {
    candidates
        .iter()
        .map(|candidate| resolve_bare(candidate, &units))
        .collect()
}

fn push_bare(
    result: &mut Vec<ExtractionCandidate>,
    token: &[u16],
    start: usize,
    units: &[String],
) -> napi::Result<()> {
    let mut begin = 0;
    let mut end = token.len();
    while begin < end && matches!(token[begin], 60 | 123 | 40 | 91) {
        begin += 1;
    }
    while end > begin && matches!(token[end - 1], 62 | 93 | 44 | 59) {
        end -= 1;
    }
    let token = &token[begin..end];
    if token.is_empty() || token.iter().any(|c| matches!(c, 61 | 91 | 93)) {
        return Ok(());
    }
    let raw_candidate = string(token);
    if resolve_bare(&raw_candidate, units)?.is_some() {
        result.push(ExtractionCandidate {
            raw_candidate,
            start: (start + begin) as u32,
            end: (start + end) as u32,
        });
    }
    Ok(())
}

#[napi]
pub fn extract_bare_arbitrary_candidates_native(
    content: String,
    units: Vec<String>,
) -> napi::Result<Vec<ExtractionCandidate>> {
    if units.is_empty() {
        return Ok(Vec::new());
    }
    let content = normalized_whitespace(&utf16(&content));
    let mut result = Vec::new();
    let mut depth: usize = 0;
    let mut quote = None;
    let mut start = 0;
    let mut i = 0;
    while i < content.len() {
        let c = content[i];
        if c == 92 {
            i += 2;
            continue;
        }
        let quote_boundary = i == start || content[i - 1] != 45;
        if let Some(q) = quote {
            if c == q {
                quote = None;
            }
        } else if matches!(c, 34 | 39 | 96) && !quote_boundary {
            quote = Some(c);
        } else if matches!(c, 40 | 123 | 91) {
            depth += 1;
        } else if matches!(c, 41 | 125 | 93) {
            depth = depth.saturating_sub(1);
        }
        if whitespace(c) || (matches!(c, 34 | 39 | 96) && depth == 0 && quote_boundary) {
            push_bare(&mut result, &content[start..i], start, &units)?;
            start = i + 1;
        }
        i += 1;
    }
    push_bare(&mut result, &content[start..], start, &units)?;
    Ok(result)
}

#[napi]
pub fn escape_css_class_name_native(value: String) -> String {
    let value = utf16(&value);
    let mut result = Vec::new();
    for (i, c) in value.iter().copied().enumerate() {
        if c == 0 {
            result.push(0xfffd);
        } else if matches!(c, 1..=31 | 127)
            || (i == 0 && matches!(c, 48..=57))
            || (i == 1 && matches!(c, 48..=57) && value[0] == 45)
        {
            result.extend(format!("\\{c:x} ").encode_utf16());
        } else if matches!(c, 128..=65535 | 45 | 95 | 48..=57 | 65..=90 | 97..=122) {
            result.push(c);
        } else {
            result.push(92);
            result.push(c);
        }
    }
    string(&result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_positions_and_class_escaping() {
        let value = "const label = '😀中文 text-red-500'";
        let ranges = create_js_string_static_ranges_native(value.into());
        assert_eq!(ranges[0].start, 15);
        assert_eq!(ranges[0].end, value.encode_utf16().count() as u32 - 1);
        assert_eq!(
            escape_css_class_name_native("😀中文:foo".into()),
            "😀中文\\:foo"
        );
    }

    #[test]
    fn brackets_keep_quoted_whitespace() {
        assert_eq!(
            split_candidate_tokens_native(
                "flex before:content-['hello world'] text-red-500\\nblock".into()
            ),
            vec![
                "flex",
                "before:content-['hello world']",
                "text-red-500",
                "block"
            ]
        );
    }

    #[test]
    fn bare_values_preserve_prefixes() {
        let result = resolve_bare_arbitrary_candidates_native(
            vec![
                "hover:!-mt-10px".into(),
                "text-var(--brand)".into(),
                "aspect-16/9".into(),
                "flex".into(),
            ],
            vec!["px".into()],
        )
        .unwrap();
        assert_eq!(
            result,
            vec![
                Some("hover:!-mt-[10px]".into()),
                Some("text-[color:var(--brand)]".into()),
                Some("aspect-[16/9]".into()),
                None
            ]
        );
    }

    #[test]
    fn inline_sources_respect_css_and_nested_braces() {
        let result = extract_inline_source_candidates_native("/* @source inline(\"ignored\"); */ @media screen { @source inline(\"{hover:,}p-{2..4..2}\"); } @source not inline(\"p-4\"); .x { content: '@source inline(\"also-ignored\");'; }".into()).unwrap();
        assert_eq!(
            result.included,
            vec!["hover:p-2", "hover:p-4", "p-2", "p-4"]
        );
        assert_eq!(result.excluded, vec!["p-4"]);
        assert!(
            extract_inline_source_candidates_native("@source inline(\"p-{1..3..0}\");".into())
                .is_err()
        );
    }

    #[test]
    fn raw_cache_preserves_lru_and_fingerprint_invalidation() {
        let mut cache = NativeRawCandidateCache::new(2);
        cache.set("a".into(), "first".into(), vec!["flex".into()]);
        cache.set("b".into(), "first".into(), vec!["grid".into()]);
        assert!(cache.get("a".into(), "changed".into()).is_none());
        assert_eq!(
            cache.get("a".into(), "first".into()).unwrap().candidates,
            vec!["flex"]
        );
        cache.set("c".into(), "first".into(), vec!["block".into()]);
        assert!(cache.get("b".into(), "first".into()).is_none());
        cache.set("a".into(), "second".into(), vec!["hidden".into()]);
        assert!(cache.get("a".into(), "first".into()).is_none());
        assert_eq!(
            cache.get("a".into(), "second".into()).unwrap().candidates,
            vec!["hidden"]
        );
    }
}

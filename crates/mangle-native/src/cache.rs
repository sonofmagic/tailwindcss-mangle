use napi_derive::napi;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

fn parse(input: &str) -> napi::Result<Value> {
    serde_json::from_str(input).map_err(|error| napi::Error::from_reason(error.to_string()))
}

fn strings(value: &Value) -> Vec<String> {
    value
        .as_array()
        .map(|values| {
            values
                .iter()
                .filter_map(|value| value.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

fn text(value: &Value) -> String {
    value
        .as_str()
        .map(str::to_owned)
        .unwrap_or_else(|| value.to_string())
}

fn prefix(value: &Value) -> String {
    text(value).chars().take(12).collect()
}

fn context_mismatch(current: &Value, cached: &Value) -> Vec<String> {
    let mut reasons = Vec::new();
    for (key, label) in [
        ("projectRootRealpath", "project-root"),
        ("processCwdRealpath", "process-cwd"),
        ("cacheCwdRealpath", "cache-cwd"),
    ] {
        if current[key] != cached[key] {
            reasons.push(format!(
                "{label} changed: {} -> {}",
                text(&cached[key]),
                text(&current[key])
            ));
        }
    }
    if current["tailwindConfigPath"].as_str().unwrap_or("")
        != cached["tailwindConfigPath"].as_str().unwrap_or("")
    {
        reasons.push(format!(
            "tailwind-config path changed: {} -> {}",
            cached["tailwindConfigPath"].as_str().unwrap_or("<none>"),
            current["tailwindConfigPath"].as_str().unwrap_or("<none>")
        ));
    }
    if current["tailwindConfigMtimeMs"].as_f64().unwrap_or(-1.0)
        != cached["tailwindConfigMtimeMs"].as_f64().unwrap_or(-1.0)
    {
        reasons.push("tailwind-config mtime changed".into());
    }
    for (key, label) in [
        ("tailwindPackageRootRealpath", "tailwind-package root"),
        ("tailwindPackageVersion", "tailwind-package version"),
        ("patcherVersion", "patcher version"),
        ("majorVersion", "major version"),
    ] {
        if current[key] != cached[key] {
            reasons.push(format!(
                "{label} changed: {} -> {}",
                text(&cached[key]),
                text(&current[key])
            ));
        }
    }
    if current["optionsHash"] != cached["optionsHash"] {
        reasons.push(format!(
            "patch options hash changed: {} -> {}",
            prefix(&cached["optionsHash"]),
            prefix(&current["optionsHash"])
        ));
    }
    reasons
}

#[napi]
pub fn explain_cache_context_mismatch_native(
    current: String,
    cached: String,
) -> napi::Result<Vec<String>> {
    Ok(context_mismatch(&parse(&current)?, &parse(&cached)?))
}

// The host supplies JSON scalar spellings and ICU-sorted property names. This
// preserves JS's number, callable, symbol, sparse-array, and locale semantics;
// Rust owns canonical assembly and hashing without reinterpreting host values.
fn stable_value(node: &Value, output: &mut String) -> napi::Result<()> {
    if let Some(atom) = node.as_str() {
        output.push_str(atom);
        return Ok(());
    }
    if node.is_null() {
        return Ok(());
    }
    if let Some(items) = node["items"].as_array() {
        output.push('[');
        for (index, item) in items.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }
            stable_value(item, output)?;
        }
        output.push(']');
        return Ok(());
    }
    if let Some(entries) = node["entries"].as_array() {
        output.push('{');
        for (index, entry) in entries.iter().enumerate() {
            let values = entry
                .as_array()
                .filter(|values| values.len() == 2)
                .ok_or_else(|| napi::Error::from_reason("Invalid stable cache object entry."))?;
            if index > 0 {
                output.push(',');
            }
            output.push_str(
                values[0]
                    .as_str()
                    .ok_or_else(|| napi::Error::from_reason("Invalid stable cache property."))?,
            );
            output.push(':');
            stable_value(&values[1], output)?;
        }
        output.push('}');
        return Ok(());
    }
    Err(napi::Error::from_reason("Invalid stable cache value."))
}

#[napi]
pub fn hash_stable_cache_value_native(tree: String) -> napi::Result<String> {
    let mut value = String::new();
    stable_value(&parse(&tree)?, &mut value)?;
    Ok(format!("{:x}", Sha256::digest(value.as_bytes())))
}

fn normalize_entry(value: &Value) -> Option<Value> {
    let record = value.as_object()?;
    let values = strings(record.get("values")?);
    if values.is_empty() {
        return None;
    }
    let context = record.get("context")?.as_object()?;
    if context.get("fingerprintVersion")?.as_u64() != Some(1)
        || !matches!(context.get("majorVersion")?.as_u64(), Some(2..=4))
    {
        return None;
    }
    let mut normalized = Map::new();
    normalized.insert("fingerprintVersion".into(), json!(1));
    for key in [
        "projectRootRealpath",
        "processCwdRealpath",
        "cacheCwdRealpath",
    ] {
        normalized.insert(key.into(), json!(context.get(key)?.as_str()?));
    }
    if let Some(value) = context.get("tailwindConfigPath").and_then(Value::as_str) {
        normalized.insert("tailwindConfigPath".into(), json!(value));
    }
    if let Some(value) = context
        .get("tailwindConfigMtimeMs")
        .filter(|value| value.is_number())
    {
        normalized.insert("tailwindConfigMtimeMs".into(), value.clone());
    }
    for key in [
        "tailwindPackageRootRealpath",
        "tailwindPackageVersion",
        "patcherVersion",
        "optionsHash",
    ] {
        normalized.insert(key.into(), json!(context.get(key)?.as_str()?));
    }
    normalized.insert("majorVersion".into(), context.get("majorVersion")?.clone());
    Some(
        json!({"context": normalized, "values": values, "updatedAt": record.get("updatedAt").and_then(Value::as_str).unwrap_or("1970-01-01T00:00:00.000Z")}),
    )
}

fn normalize_index(payload: Value) -> Value {
    if payload.is_array() {
        return json!({"kind": "legacy", "data": strings(&payload)});
    }
    if payload["schemaVersion"].as_u64() != Some(2) {
        return json!({"kind": "invalid"});
    }
    let Some(contexts) = payload["contexts"].as_object() else {
        return json!({"kind": "invalid"});
    };
    let mut normalized = Map::new();
    for (fingerprint, value) in contexts {
        if !fingerprint.is_empty()
            && let Some(entry) = normalize_entry(value)
        {
            normalized.insert(fingerprint.clone(), entry);
        }
    }
    json!({"kind": "v2", "data": {"schemaVersion": 2, "updatedAt": payload["updatedAt"].as_str().unwrap_or("1970-01-01T00:00:00.000Z"), "contexts": normalized}})
}

fn empty_index(now: &str) -> Value {
    json!({"schemaVersion": 2, "updatedAt": now, "contexts": {}})
}

fn read_result(
    data: Vec<String>,
    hit: bool,
    reason: &str,
    fingerprint: Option<&str>,
    schema: bool,
    details: Vec<String>,
) -> Value {
    let mut meta = json!({"hit": hit, "reason": reason, "details": details});
    if let Some(fingerprint) = fingerprint {
        meta["fingerprint"] = json!(fingerprint);
    }
    if schema {
        meta["schemaVersion"] = json!(2);
    }
    json!({"data": data, "meta": meta})
}

fn counts(parsed: &Value) -> (usize, usize) {
    if parsed["kind"] == "legacy" {
        let len = parsed["data"].as_array().map_or(0, Vec::len);
        return (usize::from(len > 0), len);
    }
    if parsed["kind"] == "v2"
        && let Some(contexts) = parsed["data"]["contexts"].as_object()
    {
        return (
            contexts.len(),
            contexts
                .values()
                .map(|entry| entry["values"].as_array().map_or(0, Vec::len))
                .sum(),
        );
    }
    (0, 0)
}

fn clear_plan(
    scope: &str,
    action: &str,
    files: usize,
    entries: usize,
    contexts: usize,
    payload: Option<Value>,
) -> Value {
    let mut result = json!({"action": action, "result": {"scope": scope, "filesRemoved": files, "entriesRemoved": entries, "contextsRemoved": contexts}});
    if let Some(payload) = payload {
        result["payload"] = payload;
    }
    result
}

#[napi]
pub struct NativeCacheState {
    enabled: bool,
    driver: String,
    context: Option<Value>,
    context_input: Option<String>,
    memory_cache: Option<Vec<String>>,
    memory_index: Option<Value>,
    last_read_meta: Value,
}

#[napi]
impl NativeCacheState {
    #[napi(constructor)]
    pub fn new(enabled: bool, driver: String, context: Option<String>) -> napi::Result<Self> {
        Ok(Self {
            enabled,
            driver,
            context: context.as_deref().map(parse).transpose()?,
            context_input: context,
            memory_cache: None,
            memory_index: None,
            last_read_meta: json!({"hit": false, "reason": "context-not-found", "details": []}),
        })
    }

    #[napi]
    pub fn configure(&mut self, enabled: bool, context: Option<String>) -> napi::Result<()> {
        self.enabled = enabled;
        if self.context_input != context {
            self.context = context.as_deref().map(parse).transpose()?;
            self.context_input = context;
        }
        Ok(())
    }

    #[napi]
    pub fn normalize_index(&self, payload: String) -> napi::Result<String> {
        Ok(normalize_index(parse(&payload)?).to_string())
    }

    #[napi]
    pub fn prepare_write(
        &mut self,
        values: Vec<String>,
        parsed: Option<String>,
        now: String,
    ) -> napi::Result<String> {
        if !self.enabled || self.driver == "noop" {
            return Ok(json!({"kind": "skip"}).to_string());
        }
        if self.driver == "memory" && self.context.is_none() {
            self.memory_cache = Some(values);
            return Ok(json!({"kind": "memory"}).to_string());
        }
        if self.context.is_none() {
            return Ok(json!({"kind": "file", "payload": values}).to_string());
        }
        let mut index = if self.driver == "memory" {
            self.memory_index
                .clone()
                .unwrap_or_else(|| empty_index(&now))
        } else {
            let parsed = parsed
                .as_deref()
                .map(parse)
                .transpose()?
                .unwrap_or(Value::Null);
            if parsed["kind"] == "v2" {
                parsed["data"].clone()
            } else {
                empty_index(&now)
            }
        };
        let context = self.context.as_ref().unwrap();
        let fingerprint = context["fingerprint"].as_str().unwrap();
        index["contexts"][fingerprint] =
            json!({"context": context["metadata"], "values": values, "updatedAt": now});
        index["updatedAt"] = json!(now);
        if self.driver == "memory" {
            self.memory_index = Some(index);
            Ok(json!({"kind": "memory"}).to_string())
        } else {
            Ok(json!({"kind": "file", "payload": index}).to_string())
        }
    }

    #[napi]
    pub fn read(&self, parsed: Option<String>) -> napi::Result<String> {
        if !self.enabled {
            return Ok(read_result(
                vec![],
                false,
                "cache-disabled",
                None,
                false,
                vec!["cache disabled".into()],
            )
            .to_string());
        }
        if self.driver == "noop" {
            return Ok(read_result(
                vec![],
                false,
                "noop-driver",
                None,
                false,
                vec!["cache driver is noop".into()],
            )
            .to_string());
        }
        let fingerprint = self
            .context
            .as_ref()
            .and_then(|context| context["fingerprint"].as_str());
        if self.driver == "memory" {
            if self.context.is_none() {
                let values = self.memory_cache.clone().unwrap_or_default();
                let hit = !values.is_empty();
                return Ok(read_result(
                    values,
                    hit,
                    if hit { "hit" } else { "context-not-found" },
                    None,
                    false,
                    vec![
                        if hit {
                            "memory cache hit"
                        } else {
                            "memory cache miss"
                        }
                        .into(),
                    ],
                )
                .to_string());
            }
            let Some(index) = &self.memory_index else {
                return Ok(read_result(
                    vec![],
                    false,
                    "context-not-found",
                    fingerprint,
                    true,
                    vec!["no in-memory cache index for current context".into()],
                )
                .to_string());
            };
            let fingerprint = fingerprint.unwrap();
            if let Some(entry) = index["contexts"].get(fingerprint) {
                return Ok(read_result(
                    strings(&entry["values"]),
                    true,
                    "hit",
                    Some(fingerprint),
                    true,
                    vec!["memory cache hit".into()],
                )
                .to_string());
            }
            let current = &self.context.as_ref().unwrap()["metadata"];
            if let Some(entry) = index["contexts"].as_object().and_then(|contexts| {
                contexts.values().find(|entry| {
                    entry["context"]["projectRootRealpath"] == current["projectRootRealpath"]
                })
            }) {
                return Ok(read_result(
                    vec![],
                    false,
                    "context-mismatch",
                    Some(fingerprint),
                    true,
                    context_mismatch(current, &entry["context"]),
                )
                .to_string());
            }
            return Ok(read_result(
                vec![],
                false,
                "context-not-found",
                Some(fingerprint),
                true,
                vec!["context fingerprint not found in memory cache index".into()],
            )
            .to_string());
        }
        let parsed = parsed
            .as_deref()
            .map(parse)
            .transpose()?
            .unwrap_or_else(|| json!({"kind": "empty"}));
        if parsed["kind"] == "empty" {
            return Ok(read_result(
                vec![],
                false,
                "file-missing",
                None,
                false,
                vec!["cache file not found".into()],
            )
            .to_string());
        }
        if parsed["kind"] == "invalid" {
            return Ok(read_result(
                vec![],
                false,
                "invalid-schema",
                None,
                false,
                vec!["cache schema invalid and has been reset".into()],
            )
            .to_string());
        }
        if self.context.is_none() {
            let legacy = parsed["kind"] == "legacy";
            let values = if legacy {
                strings(&parsed["data"])
            } else {
                parsed["data"]["contexts"]
                    .as_object()
                    .map(|contexts| {
                        contexts
                            .values()
                            .flat_map(|entry| strings(&entry["values"]))
                            .collect()
                    })
                    .unwrap_or_default()
            };
            let hit = !values.is_empty();
            return Ok(read_result(
                values,
                hit,
                if hit { "hit" } else { "context-not-found" },
                None,
                !legacy,
                vec![
                    if legacy {
                        "legacy cache format"
                    } else {
                        "context-less read merged all cache entries"
                    }
                    .into(),
                ],
            )
            .to_string());
        }
        if parsed["kind"] == "legacy" {
            return Ok(read_result(
                vec![],
                false,
                "legacy-schema",
                fingerprint,
                false,
                vec![
                    "legacy cache schema detected; rebuilding cache with context fingerprint"
                        .into(),
                ],
            )
            .to_string());
        }
        let context = self.context.as_ref().unwrap();
        let fingerprint = fingerprint.unwrap();
        let current = &context["metadata"];
        if let Some(entry) = parsed["data"]["contexts"].get(fingerprint) {
            let mismatch = context_mismatch(current, &entry["context"]);
            return Ok(if mismatch.is_empty() {
                read_result(
                    strings(&entry["values"]),
                    true,
                    "hit",
                    Some(fingerprint),
                    true,
                    vec![format!(
                        "context fingerprint {} matched",
                        prefix(&context["fingerprint"])
                    )],
                )
            } else {
                read_result(
                    vec![],
                    false,
                    "context-mismatch",
                    Some(fingerprint),
                    true,
                    mismatch,
                )
            }
            .to_string());
        }
        if let Some((matched_fingerprint, entry)) =
            parsed["data"]["contexts"].as_object().and_then(|contexts| {
                contexts.iter().find(|(_, entry)| {
                    entry["context"]["projectRootRealpath"] == current["projectRootRealpath"]
                })
            })
        {
            let mut details = vec![format!(
                "nearest context fingerprint: {}",
                matched_fingerprint.chars().take(12).collect::<String>()
            )];
            details.extend(context_mismatch(current, &entry["context"]));
            return Ok(read_result(
                vec![],
                false,
                "context-mismatch",
                Some(fingerprint),
                true,
                details,
            )
            .to_string());
        }
        Ok(read_result(
            vec![],
            false,
            "context-not-found",
            Some(fingerprint),
            true,
            vec!["context fingerprint not found in cache index".into()],
        )
        .to_string())
    }

    #[napi]
    pub fn remember_read_meta(&mut self, meta: String) -> napi::Result<()> {
        self.last_read_meta = parse(&meta)?;
        Ok(())
    }

    #[napi]
    pub fn get_last_read_meta(&self) -> String {
        self.last_read_meta.to_string()
    }

    #[napi]
    pub fn prepare_clear(
        &mut self,
        scope: String,
        parsed: Option<String>,
        now: String,
    ) -> napi::Result<String> {
        if !self.enabled || self.driver == "noop" {
            return Ok(clear_plan(&scope, "none", 0, 0, 0, None).to_string());
        }
        if self.driver == "memory" {
            if self.context.is_none() || scope == "all" {
                let (contexts, entries) = if let Some(index) = &self.memory_index {
                    counts(&json!({"kind": "v2", "data": index}))
                } else {
                    let len = self.memory_cache.as_ref().map_or(0, Vec::len);
                    (usize::from(len > 0), len)
                };
                self.memory_cache = None;
                self.memory_index = None;
                return Ok(clear_plan(&scope, "none", 0, entries, contexts, None).to_string());
            }
            let fingerprint = self.context.as_ref().unwrap()["fingerprint"]
                .as_str()
                .unwrap();
            if let Some(contexts) = self
                .memory_index
                .as_mut()
                .and_then(|index| index["contexts"].as_object_mut())
                && let Some(entry) = contexts.shift_remove(fingerprint)
            {
                return Ok(
                    clear_plan(&scope, "none", 0, strings(&entry["values"]).len(), 1, None)
                        .to_string(),
                );
            }
            return Ok(clear_plan(&scope, "none", 0, 0, 0, None).to_string());
        }
        let mut parsed = parsed
            .as_deref()
            .map(parse)
            .transpose()?
            .unwrap_or_else(|| json!({"kind": "empty"}));
        if parsed["kind"] == "empty" {
            return Ok(clear_plan(&scope, "none", 0, 0, 0, None).to_string());
        }
        if self.context.is_none() || scope == "all" || parsed["kind"] != "v2" {
            let (contexts, entries) = counts(&parsed);
            return Ok(clear_plan(&scope, "remove", 1, entries, contexts, None).to_string());
        }
        let fingerprint = self.context.as_ref().unwrap()["fingerprint"]
            .as_str()
            .unwrap();
        let contexts = parsed["data"]["contexts"].as_object_mut().unwrap();
        let Some(entry) = contexts.shift_remove(fingerprint) else {
            return Ok(clear_plan(&scope, "none", 0, 0, 0, None).to_string());
        };
        let entries = strings(&entry["values"]).len();
        if contexts.is_empty() {
            return Ok(clear_plan(&scope, "remove", 1, entries, 1, None).to_string());
        }
        parsed["data"]["updatedAt"] = json!(now);
        Ok(clear_plan(&scope, "write", 0, entries, 1, Some(parsed["data"].clone())).to_string())
    }

    #[napi]
    pub fn snapshot(&self, parsed: Option<String>) -> napi::Result<Option<String>> {
        if self.driver == "memory" {
            return Ok(self.memory_index.as_ref().map(Value::to_string));
        }
        let parsed = parsed
            .as_deref()
            .map(parse)
            .transpose()?
            .unwrap_or(Value::Null);
        Ok((parsed["kind"] == "v2").then(|| parsed["data"].to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_sparse_and_dynamic_stable_serialization() {
        let tree = json!({"items": ["\"undefined\"", null, {"entries": [["\"a\"", "null"]]}, "\"Symbol(x)\""]});
        let mut output = String::new();
        stable_value(&tree, &mut output).unwrap();
        assert_eq!(output, "[\"undefined\",,{\"a\":null},\"Symbol(x)\"]");
    }

    #[test]
    fn rejects_invalid_contexts_and_keeps_legacy_strings() {
        assert_eq!(
            normalize_index(json!(["a", 1, false])),
            json!({"kind": "legacy", "data": ["a"]})
        );
        assert_eq!(
            normalize_index(
                json!({"schemaVersion": 2, "contexts": {"a": {"values": ["x"], "context": {}}}})
            )["data"]["contexts"],
            json!({})
        );
    }
}

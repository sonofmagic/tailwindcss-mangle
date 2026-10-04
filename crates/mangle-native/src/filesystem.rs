use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Task};
use napi_derive::napi;
use std::collections::{HashSet, VecDeque};
use std::path::PathBuf;

pub struct WorkspaceFilesTask {
    root: PathBuf,
    max_depth: u32,
    names: HashSet<String>,
}

impl Task for WorkspaceFilesTask {
    type Output = Vec<String>;
    type JsValue = Vec<String>;

    fn compute(&mut self) -> napi::Result<Self::Output> {
        let mut queue = VecDeque::from([(self.root.clone(), 0)]);
        let mut files = Vec::new();
        while let Some((dir, depth)) = queue.pop_front() {
            let Ok(entries) = std::fs::read_dir(dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let Ok(kind) = entry.file_type() else {
                    continue;
                };
                let name = entry.file_name().to_string_lossy().into_owned();
                if kind.is_file() && self.names.contains(&name) {
                    files.push(entry.path().to_string_lossy().into_owned());
                } else if kind.is_dir()
                    && depth < self.max_depth
                    && !matches!(
                        name.as_str(),
                        ".git"
                            | ".idea"
                            | ".turbo"
                            | ".vscode"
                            | ".yarn"
                            | "coverage"
                            | "dist"
                            | "node_modules"
                            | "tmp"
                    )
                {
                    queue.push_back((entry.path(), depth + 1));
                }
            }
        }
        Ok(files)
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> napi::Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi(ts_return_type = "Promise<string[]>")]
pub fn collect_workspace_config_files_native(
    root: String,
    max_depth: u32,
    names: Vec<String>,
) -> AsyncTask<WorkspaceFilesTask> {
    AsyncTask::new(WorkspaceFilesTask {
        root: root.into(),
        max_depth,
        names: names.into_iter().collect(),
    })
}

// The original JavaScript glob regex had no `u` flag: `?` consumes one UTF-16
// code unit, including half of an astral character. Give every code unit a
// distinct valid scalar so Rust's Unicode regex keeps that behavior without
// confusing literal characters with regex syntax or surrogate pairs.
fn glob_code_unit(unit: u16) -> char {
    char::from_u32(0x10000 + u32::from(unit)).expect("encoded UTF-16 unit is a valid scalar")
}

fn glob_input(value: &str) -> String {
    value.encode_utf16().map(glob_code_unit).collect()
}

fn glob_regex(pattern: &str) -> Result<regex::Regex, regex::Error> {
    let normalized = pattern.trim().replace('\\', "/");
    let normalized = normalized
        .strip_prefix("./")
        .unwrap_or(&normalized)
        .trim_start_matches('/');
    let mut chars = normalized.encode_utf16().peekable();
    let mut regex = String::from("^");
    while let Some(c) = chars.next() {
        match c {
            0x2a if chars.peek() == Some(&0x2a) => {
                chars.next();
                regex.push_str("[^\\x{1000a}\\x{1000d}\\x{12028}\\x{12029}]*");
            }
            0x2a => regex.push_str("[^\\x{1002f}]*"),
            0x3f => regex.push_str("[^\\x{1002f}]"),
            _ => regex.push(glob_code_unit(c)),
        }
    }
    regex.push('$');
    regex::Regex::new(&regex)
}

#[napi]
pub fn filter_migration_target_indexes_native(
    files: Vec<String>,
    include: Vec<String>,
    exclude: Vec<String>,
) -> napi::Result<Vec<u32>> {
    let compile = |patterns: Vec<String>| -> napi::Result<Vec<regex::Regex>> {
        patterns
            .iter()
            .filter(|p| !p.trim().is_empty())
            .map(|p| glob_regex(p).map_err(|e| napi::Error::from_reason(e.to_string())))
            .collect()
    };
    let include = compile(include)?;
    let exclude = compile(exclude)?;
    Ok(files
        .iter()
        .enumerate()
        .filter_map(|(i, file)| {
            let input = glob_input(file);
            ((include.is_empty() || include.iter().any(|r| r.is_match(&input)))
                && !exclude.iter().any(|r| r.is_match(&input)))
            .then_some(i as u32)
        })
        .collect())
}

#[napi(object)]
pub struct RestoreWrite {
    pub file: String,
    pub source: String,
}

pub struct MigrationWriteTask {
    file: PathBuf,
    source: String,
    code: String,
    backup: Option<PathBuf>,
}

impl Task for MigrationWriteTask {
    type Output = bool;
    type JsValue = bool;

    fn compute(&mut self) -> napi::Result<bool> {
        let write = || -> std::io::Result<bool> {
            if let Some(backup) = &self.backup {
                if let Some(parent) = backup.parent() {
                    std::fs::create_dir_all(parent)?;
                }
                std::fs::write(backup, &self.source)?;
            }
            std::fs::write(&self.file, &self.code)?;
            Ok(self.backup.is_some())
        };
        write().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    fn resolve(&mut self, _env: Env, result: bool) -> napi::Result<bool> {
        Ok(result)
    }
}

#[napi(ts_return_type = "Promise<boolean>")]
pub fn write_migration_file_native(
    file: String,
    source: String,
    code: String,
    backup: Option<String>,
) -> AsyncTask<MigrationWriteTask> {
    AsyncTask::new(MigrationWriteTask {
        file: file.into(),
        source,
        code,
        backup: backup.map(Into::into),
    })
}

pub struct RollbackWritesTask {
    entries: Vec<RestoreWrite>,
}

impl Task for RollbackWritesTask {
    type Output = Vec<u32>;
    type JsValue = Vec<u32>;

    fn compute(&mut self) -> napi::Result<Vec<u32>> {
        Ok(self
            .entries
            .iter()
            .enumerate()
            .rev()
            .filter_map(|(i, entry)| {
                std::fs::write(&entry.file, &entry.source)
                    .is_ok()
                    .then_some(i as u32)
            })
            .collect())
    }

    fn resolve(&mut self, _env: Env, result: Vec<u32>) -> napi::Result<Vec<u32>> {
        Ok(result)
    }
}

#[napi(ts_return_type = "Promise<number[]>")]
pub fn rollback_migration_writes_native(
    entries: Vec<RestoreWrite>,
) -> AsyncTask<RollbackWritesTask> {
    AsyncTask::new(RollbackWritesTask { entries })
}

#[napi(object)]
pub struct RestoreEntry {
    pub file: Option<String>,
    pub backup_file: Option<String>,
}

#[napi(object)]
#[derive(Default)]
pub struct RestoreResult {
    pub scanned_entries: u32,
    pub restorable_entries: u32,
    pub restored_files: u32,
    pub missing_backups: u32,
    pub skipped_entries: u32,
    pub restored: Vec<String>,
}

pub struct RestoreFilesTask {
    entries: Vec<RestoreEntry>,
    dry_run: bool,
}

impl Task for RestoreFilesTask {
    type Output = RestoreResult;
    type JsValue = RestoreResult;

    fn compute(&mut self) -> napi::Result<RestoreResult> {
        let mut result = RestoreResult::default();
        for entry in &self.entries {
            result.scanned_entries += 1;
            let (Some(file), Some(backup)) = (&entry.file, &entry.backup_file) else {
                result.skipped_entries += 1;
                continue;
            };
            result.restorable_entries += 1;
            if !std::path::Path::new(backup).exists() {
                result.missing_backups += 1;
                continue;
            }
            if !self.dry_run {
                let restore = || -> std::io::Result<()> {
                    let content = std::fs::read(backup)?;
                    if let Some(parent) = std::path::Path::new(file).parent() {
                        std::fs::create_dir_all(parent)?;
                    }
                    std::fs::write(file, content)
                };
                restore().map_err(|e| napi::Error::from_reason(e.to_string()))?;
            }
            result.restored_files += 1;
            result.restored.push(file.clone());
        }
        Ok(result)
    }

    fn resolve(&mut self, _env: Env, result: RestoreResult) -> napi::Result<RestoreResult> {
        Ok(result)
    }
}

#[napi(ts_return_type = "Promise<RestoreResult>")]
pub fn restore_config_entries_native(
    entries: Vec<RestoreEntry>,
    dry_run: bool,
) -> AsyncTask<RestoreFilesTask> {
    AsyncTask::new(RestoreFilesTask { entries, dry_run })
}

#[cfg(test)]
mod tests {
    use super::{glob_input, glob_regex};

    #[test]
    fn migration_globs_match_utf16_code_units() {
        let filename = glob_input("apps/😀/tailwindcss-patch.config.ts");
        assert!(
            !glob_regex("apps/?/tailwindcss-patch.config.ts")
                .unwrap()
                .is_match(&filename)
        );
        for pattern in ["??", "*?", "?*", "?*?", "😀"] {
            assert!(
                glob_regex(&format!("apps/{pattern}/tailwindcss-patch.config.ts"))
                    .unwrap()
                    .is_match(&filename)
            );
        }
        assert!(glob_regex("中?").unwrap().is_match(&glob_input("中a")));
        assert!(glob_regex("𐀯").unwrap().is_match(&glob_input("𐀯")));
        assert!(!glob_regex("?").unwrap().is_match(&glob_input("𐀯")));
    }

    #[test]
    fn migration_globs_keep_literal_and_wildcard_boundaries() {
        assert!(
            glob_regex("[a].ts")
                .unwrap()
                .is_match(&glob_input("[a].ts"))
        );
        assert!(!glob_regex("[a].ts").unwrap().is_match(&glob_input("a.ts")));
        assert!(!glob_regex("*").unwrap().is_match(&glob_input("a/b")));
        assert!(glob_regex("**").unwrap().is_match(&glob_input("a/b")));
        for newline in ['\n', '\r', '\u{2028}', '\u{2029}'] {
            let input = glob_input(&format!("a{newline}b"));
            assert!(glob_regex("*").unwrap().is_match(&input));
            assert!(!glob_regex("**").unwrap().is_match(&input));
        }
    }
}

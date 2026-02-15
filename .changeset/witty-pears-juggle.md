---
"tailwindcss-patch": patch
---

Add backup snapshot support for `tw-patch migrate`.

- introduce `--backup-dir` to save pre-migration file snapshots
- include backup metadata in migration reports
- extend tests to cover backup output paths and content

---
"tailwindcss-patch": patch
---

Add a migration report validation CLI command.

- introduce `tw-patch validate` to verify migration report compatibility without restoring files
- reuse restore dry-run checks for schema validation and backup reference scanning
- support `--report-file`, `--strict`, and `--json` for validation workflows

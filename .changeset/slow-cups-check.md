---
"tailwindcss-patch": minor
---

Add `tw-patch restore` command to recover configs from migration backups.

- introduce `restore` command with `--report-file`, `--dry-run`, `--strict`, and `--json`
- add restore core API that replays `backupFile` entries from migration reports
- include tests for restore success, dry-run behavior, and strict missing-backup failures

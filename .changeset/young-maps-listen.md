---
"tailwindcss-patch": patch
---

Extend `tw-patch migrate` with scan filtering and report persistence.

- add `--include` and `--exclude` glob filters for migration target control
- add `--report-file` to persist migration JSON reports
- keep compatibility with existing `--workspace`, `--check`, and `--backup-dir` flows

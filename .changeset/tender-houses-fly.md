---
"tailwindcss-patch": patch
---

Improve restore JSON observability for migration reports.

- expose `reportKind` and `reportSchemaVersion` in `tw-patch restore --json` output when report metadata is present
- keep compatibility with legacy reports that do not contain schema metadata
- add unit tests for metadata and legacy restore report behavior

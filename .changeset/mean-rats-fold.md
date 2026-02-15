---
"tailwindcss-patch": patch
---

Add migration report schema metadata and restore compatibility validation.

- include `reportKind`, `schemaVersion`, `generatedAt`, and `tool` metadata in `tw-patch migrate` reports
- validate `reportKind` and `schemaVersion` in `tw-patch restore` for safer report compatibility checks
- keep backward compatibility with legacy reports that do not include envelope metadata

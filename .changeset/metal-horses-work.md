---
"tailwindcss-patch": patch
---

Publish schema for validate JSON output.

- add `tailwindcss-patch/validate-result.schema.json` for `tw-patch validate --json`
- include failure payload contract (`reason`, `exitCode`, `message`) alongside success shape reference
- export `VALIDATE_FAILURE_REASONS` and align schema tests with public validate constants

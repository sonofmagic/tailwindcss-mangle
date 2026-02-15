---
"tailwindcss-patch": patch
---

Publish schema for validate JSON output.

- add `tailwindcss-patch/validate-result.schema.json` for `tw-patch validate --json`
- include success/failure payload contracts (`ok: true` success and `ok: false` failure with `reason`, `exitCode`, `message`)
- export `VALIDATE_FAILURE_REASONS` and align schema tests with public validate constants

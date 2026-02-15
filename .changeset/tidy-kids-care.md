---
"tailwindcss-patch": patch
---

Publish JSON schema for restore and validate outputs.

- add `tailwindcss-patch/restore-result.schema.json` for `tw-patch restore --json` and `tw-patch validate --json`
- expose the schema through package exports (source and publish configs)
- add tests and docs to keep schema fields aligned with public report constants

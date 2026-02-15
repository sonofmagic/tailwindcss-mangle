---
"tailwindcss-patch": patch
---

Expose migration report types and publish a JSON schema.

- export migration report helpers, constants, and related types from the package entry
- publish `tailwindcss-patch/migration-report.schema.json` as a stable schema subpath
- add tests to verify schema availability and alignment with exported constants

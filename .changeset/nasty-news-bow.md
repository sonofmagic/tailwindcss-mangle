---
"tailwindcss-patch": patch
---

Refactor GitHub Actions migration-report templates to use a shared composite action.

- add `examples/github-actions/actions/validate-migration-report/action.yml`
- deduplicate migrate/validate shell logic across single, matrix, and affected templates
- keep CI exit-code mapping (`21/22/23`) centralized in one reusable action

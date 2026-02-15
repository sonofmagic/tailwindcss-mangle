---
"tailwindcss-patch": patch
---

Improve the shared GitHub Actions composite action with optional environment setup controls.

- add optional inputs to `validate-migration-report` action for pnpm/node setup and dependency install
- switch single/matrix/affected workflow templates to use action-managed setup/install
- document new action inputs in README and migration notes

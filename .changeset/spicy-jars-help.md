---
"tailwindcss-patch": patch
---

Enhance `tw-patch migrate` for monorepo workflows with recursive workspace scanning.

- add `--workspace` to discover `tailwindcss-patch.config.*` and `tailwindcss-mangle.config.*` in sub-projects
- add `--max-depth` to control recursion depth (default `6`)
- ignore common generated folders such as `node_modules`, `.git`, and `dist` during workspace scans

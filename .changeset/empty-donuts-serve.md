---
"tailwindcss-patch": patch
---

Improve CI template maintainability with a testable affected-shard resolver and workflow linting.

- extract affected-shard detection logic to `examples/github-actions/scripts/resolve-shards.mjs`
- add unit tests covering resolver behavior and output contract
- add `.github/workflows/workflow-lint.yml` to lint workflow templates and verify local template wiring

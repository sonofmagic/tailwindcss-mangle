---
"tailwindcss-patch": patch
---

Add a stable JSON contract for affected-shard resolver outputs and enforce it in CI.

- add resolver JSON output mode (`RESOLVE_SHARDS_OUTPUT=json`) in `resolve-shards.mjs`
- add resolver output schema and workflow-dispatch snapshot fixtures
- add contract snapshot diff check in `.github/workflows/workflow-lint.yml`
- extend resolver tests to cover JSON contract and snapshot alignment

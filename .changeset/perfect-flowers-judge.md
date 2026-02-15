---
"tailwindcss-patch": patch
---

Add a matrix GitHub Actions template for monorepo migration report validation.

- add `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-matrix.yml`
- split validation into `root`, `apps`, and `packages` shards with per-shard artifacts
- document single-job and matrix template choices in README and migration notes

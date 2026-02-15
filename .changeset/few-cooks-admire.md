---
"tailwindcss-patch": patch
---

Add a PR diff-aware GitHub Actions template for migration report validation in monorepos.

- add `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-affected.yml`
- detect affected shards from pull request file changes and only run required shards
- add docs links in README/README-cn and migration notes

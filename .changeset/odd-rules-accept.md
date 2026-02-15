---
"tailwindcss-patch": patch
---

Improve the affected-shards GitHub Actions template for monorepo validation.

- add optional repo-level shard config support via `.tw-patch/ci-shards.json`
- add base SHA fallback logic (`merge-base`) and safer run-all fallbacks when diff resolution fails
- expand default run-all triggers for root/tooling changes
- add `ci-shards.example.json` and document customization in README/MIGRATION

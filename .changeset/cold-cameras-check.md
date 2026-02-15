---
"tailwindcss-patch": minor
---

Introduce context-aware cache governance for `tailwindcss-patch` with schema v2 isolation and explicit cache management APIs.

- add context fingerprint based cache isolation (cwd/config/package/options/version) to prevent cross-project cache pollution in monorepos
- upgrade cache index schema to include `schemaVersion` and per-context metadata, with safe legacy fallback and lazy rebuild behavior
- add `TailwindcssPatcher#clearCache(options?)` to clear current context (default) or all cache contexts with removal statistics
- improve cache observability via debug logs that explain hit/miss reasons and mismatch details
- harden file cache writes with lock-file coordination plus atomic temp-file rename for concurrent writers
- add coverage for same-project hit, cross-project isolation, config/version invalidation, clearCache scopes, legacy schema handling, and concurrent writes

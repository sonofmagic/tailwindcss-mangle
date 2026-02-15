---
"tailwindcss-patch": minor
---

Add `tw-patch migrate` to automatically rewrite deprecated config keys to the modern option shape.

- introduce a migration engine for `tailwindcss-patch.config.*` and `tailwindcss-mangle.config.*`
- support dry-run previews via `tw-patch migrate --dry-run`
- migrate common legacy keys such as `output` -> `extract`, `tailwind` -> `tailwindcss`, `overwrite` -> `apply.overwrite`, plus nested legacy aliases
- include migration summaries to explain per-file changes

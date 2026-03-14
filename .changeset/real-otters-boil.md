---
"tailwindcss-patch": major
---

Finalize the v9 `tailwindcss-patch` upgrade:

- require the modern `TailwindcssPatcher` option shape and reject legacy constructor aliases
- require explicit `tailwindcss.version` and validate it against the resolved Tailwind package version
- reject legacy workspace registry aliases such as `registry.output`, `registry.tailwind`, and `registry.patch`
- default generated config to `registry.tailwindcss.version = 4`
- document the v8 -> v9 migration path and modern-only configuration model

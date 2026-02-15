---
"@tailwindcss-mangle/config": patch
"tailwindcss-patch": patch
---

Add modern `defineConfig` registry support and bridge it end-to-end into `tailwindcss-patch`.

- extend `@tailwindcss-mangle/config` `RegistryOptions` to support modern fields: `projectRoot`, `tailwindcss`, `apply`, `extract`, `cache`, and `filter`
- keep legacy `registry.output` and `registry.tailwind` available with deprecation annotations
- update `initConfig` and default registry shape to include modern `extract`/`tailwindcss` keys
- update `tailwindcss-patch` unified config mapping to read both modern and legacy registry fields, preferring modern values when both are present

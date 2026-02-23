---
"@tailwindcss-mangle/config": patch
"@tailwindcss-mangle/shared": patch
"tailwindcss-patch": patch
---

Fix workspace install and e2e stability when package dist artifacts are unavailable during lifecycle scripts.

- Keep published entry fields for config/shared/tailwindcss-patch pointing to `dist` outputs.
- Make `tw-patch install` resilient in monorepo installs by avoiding eager config loading and lazily resolving config/shared modules with source fallbacks.
- Prevent CI install failures caused by module resolution during app `prepare`/`postinstall` hooks.

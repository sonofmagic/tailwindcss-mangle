---
'@tailwindcss-mangle/config': patch
'@tailwindcss-mangle/core': patch
'@tailwindcss-mangle/shared': patch
---

Align workspace package metadata with built `dist` outputs and fix config consumption to use the modern `registry.extract.file` fallback. Demo apps now declare the workspace packages they execute or import so Turbo can derive internal build dependencies correctly.

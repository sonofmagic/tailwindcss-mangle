---
"unplugin-tailwindcss-mangle": patch
"tailwindcss-patch": patch
"@tailwindcss-mangle/core": patch
"@tailwindcss-mangle/shared": patch
"@tailwindcss-mangle/config": patch
---

fix: use compiler-aware transforms and stabilize workspace runtime exports

- route included source files to the correct AST handler by file/query language hints
- avoid webpack html child-compilation transform conflicts and improve filter behavior
- add app integration e2e coverage for vite/nuxt/astro/next/webpack examples
- expose workspace package runtime entries from dist for stable next/webpack consumption

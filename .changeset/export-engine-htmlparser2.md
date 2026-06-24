---
"@tailwindcss-mangle/engine": patch
"@tailwindcss-mangle/core": patch
---

Export the bundled htmlparser2 API from `@tailwindcss-mangle/engine/htmlparser2` for packages that need the same Node.js 18-compatible parser entry.

Switch core HTML parsing to the engine-provided htmlparser2 entry instead of depending on htmlparser2 directly.

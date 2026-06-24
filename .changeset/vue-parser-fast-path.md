---
"@tailwindcss-mangle/engine": patch
---

Speed up Vue-like source extraction by using htmlparser2 to read class attributes and scanning only candidate-bearing template, script string, and style @apply segments.

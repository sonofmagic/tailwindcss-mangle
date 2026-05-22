---
"tailwindcss-patch": patch
---

Support Tailwind CSS v4 source detection syntax, including `@import "tailwindcss" source(...)`, `source(none)`, `@source`, `@source not`, `@source inline(...)`, and `@source not inline(...)`, matching the default scanner behavior used by the official PostCSS and Vite integrations.

---
'tailwindcss-patch': patch
---

Fix the published CommonJS runtime entry so non-CLI APIs no longer eagerly load the ESM-only `cac` dependency. CLI code is now split into a separate lazy-loaded bundle, which keeps `require('tailwindcss-patch')` working in CommonJS config loaders while preserving CLI factory support.

---
'tailwindcss-patch': patch
---

Ensure Tailwind v4 candidate extraction only keeps class names that compile to CSS so HTTP header literals like `text/event-stream` no longer leak into the runtime class set.

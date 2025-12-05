---
'tailwindcss-patch': patch
---

Fix `getClassSetSync()` returning an empty set before Tailwind v3 contexts are ready so runtime collectors fall back to the async extraction path instead of skipping class discovery.

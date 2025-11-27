---
'tailwindcss-patch': patch
---

Ensure TailwindcssPatcher uses the workspace root as the default v4 source when cssEntries point at empty folders so extract() still reports runtime classes in v4 mode.

---
"tailwindcss-patch": patch
---

fix cache store to write through temp files and rename atomically so concurrent patchers never read truncated JSON

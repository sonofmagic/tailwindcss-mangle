---
"tailwindcss-patch": patch
---

Fix Tailwind CSS v3 runtime context refresh so removed classes are dropped correctly across repeated patcher recreations, including HMR-style update flows that add and then remove content classes in the same process.

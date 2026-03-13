---
"tailwindcss-patch": patch
---

Improve `tailwindcss-patch` cold-start and repeated-run performance by avoiding redundant patch work, reducing unnecessary cache writes, and reusing Tailwind v4 candidate extraction state across repeated calls. Also add benchmark coverage and regression tests for cache invalidation, repeated patch/getClassSet calls, empty class sets, and v3/v4 behavior.

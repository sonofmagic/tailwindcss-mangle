---
"@tailwindcss-mangle/native": minor
"@tailwindcss-mangle/shared": patch
"@tailwindcss-mangle/core": patch
"@tailwindcss-mangle/engine": patch
"tailwindcss-patch": patch
"unplugin-tailwindcss-mangle": patch
---

Move transformation, candidate processing, patching, configuration migration, and cache computation into Rust kernels while preserving the npm APIs and Tailwind 2/3/4 integrations. Ship prebuilt N-API binaries and a portable Rust WASI backend, retaining the engine's Node.js 18 runtime support. Preserve mutable contexts, custom JavaScript callbacks, usage tracking, and source locations across the native boundary.

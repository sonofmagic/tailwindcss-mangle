---
"@tailwindcss-mangle/shared": major
"@tailwindcss-mangle/config": major
"@tailwindcss-mangle/core": major
"tailwindcss-patch": major
"unplugin-tailwindcss-mangle": major
---

升级 packages 内 Babel 相关依赖到 Babel 8，并将受影响 packages 的 Node.js 运行要求提升到 22.18.0 及以上。

除 `@tailwindcss-mangle/engine` 继续同时发布 CJS 和 ESM 外，其余 packages 改为仅发布 ESM 入口。

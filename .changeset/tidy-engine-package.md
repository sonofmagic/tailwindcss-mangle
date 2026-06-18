---
"@tailwindcss-mangle/engine": minor
"tailwindcss-patch": minor
---

新增独立的 Tailwind CSS 引擎包，承载候选类名提取、Tailwind v3/v4 样式生成、v4 source 扫描与 bare arbitrary value 解析能力。

`tailwindcss-patch` 现在通过 `@tailwindcss-mangle/engine` 复用这些能力，并保留原有公共导出兼容性；同时将 Node.js 版本要求提升到 `>=22.13.0`。

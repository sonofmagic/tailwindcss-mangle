---
"@tailwindcss-mangle/engine": minor
---

新增可复用的 Tailwind 生成会话和结构化 CSS AST 产物 API，支持显式候选类、source entries、失效与释放，同时保持现有 `createTailwindV4Engine().generate()` 调用兼容，并增强 Oxide 文件扫描为空时的兼容处理。

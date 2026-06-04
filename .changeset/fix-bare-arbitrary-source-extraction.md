---
"tailwindcss-patch": patch
---

支持在 source 扫描和 v4 生成器中提取 UnoCSS 风格裸任意值 class，并导出对应 resolver 与 selector 工具，便于上层 Tailwind v3 / v4 适配复用同一套候选解析。

同时将 workspace 入口对齐到构建后的 dist 产物，避免上层项目在 Vite/Node 运行时直接解析源码入口。

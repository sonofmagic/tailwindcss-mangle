---
"tailwindcss-patch": patch
---

支持 Tailwind CSS v4 通过 `cssSources` 传入构建器捕获的内存 CSS 入口，让调用方可以在 CSS 尚未落盘为 `cssEntries` 时完成入口解析、依赖记录和候选类名收集。

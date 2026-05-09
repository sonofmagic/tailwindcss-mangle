---
'tailwindcss-patch': minor
---

新增 `bareArbitraryValues` 选项，默认关闭。开启后，`tailwindcss-patch` 会把 UnoCSS 风格的裸任意值（例如 `p-10%`、`p-2.5px`、`m-4rem`）纳入 v4 候选收集与生成流程，并在输出中保留原始类名选择器。

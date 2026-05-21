---
"tailwindcss-patch": patch
---

修复 CSS-like 文件源码候选提取时，`@apply` 参数中的任意值工具类可能被整段 CSS scanner 漏掉的问题。

---
"@tailwindcss-mangle/core": patch
---

移除 `@ast-core/escape` 运行时依赖，并内联等价的 JS 字符串转义逻辑以保持字符串字面量改写行为不变。

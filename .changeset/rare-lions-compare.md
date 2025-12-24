---
"@tailwindcss-mangle/core": minor
"unplugin-tailwindcss-mangle": minor
---

Add AST-based transformation support for Vue SFC, Svelte components, and JSX/TSX using framework-specific compilers. This provides more precise class name mangling for framework-specific files.

**Features:**
- Vue SFC handler: Parse and transform classes in template, script, and style sections using `@vue/compiler-sfc`
- Svelte handler: Parse and transform classes in components with support for class directives using `svelte/compiler`
- JSX/TSX support: Enable Babel `jsx` and `typescript` plugins for proper React component transformation
- Proper AST traversal for accurate class name replacement in all framework files
- Comprehensive test coverage for Vue, Svelte, and JSX/TSX transformations

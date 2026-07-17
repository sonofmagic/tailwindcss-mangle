# @tailwindcss-mangle/engine

## 0.2.0

### Minor Changes

- ✨ **新增可复用的 Tailwind 生成会话和结构化 CSS AST 产物 API，支持显式候选类、source entries、失效与释放，同时保持现有 `createTailwindV4Engine().generate()` 调用兼容，并增强 Oxide 文件扫描为空时的兼容处理。** [`0e45825`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0e45825fae5bac9ba654aaa50602e60f4da03068) by @sonofmagic

### Patch Changes

- 🐛 **deps: upgrade** [`8755961`](https://github.com/sonofmagic/tailwindcss-mangle/commit/87559611db4ec070c6a6d3159b1ca7c5367a6eb2) by @sonofmagic

## 0.1.3

### Patch Changes

- 🐛 **Respect disabled Tailwind v4 source scanning by stripping compiled `@source` roots before generation.** [`8034bc2`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8034bc2015823944c58f0649f127df2ac1ff3633) by @sonofmagic

## 0.1.2

### Patch Changes

- 🐛 **deps: upgrade** [`c0f30dd`](https://github.com/sonofmagic/tailwindcss-mangle/commit/c0f30dda0db7aec99b0289938eb8bbdee75a09ba) by @sonofmagic

- 🐛 **deps: upgrade** [`3257c5c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/3257c5c3455d8baad602bea9828c9eea3e9a0be4) by @sonofmagic

## 0.1.1

### Patch Changes

- 🐛 **Export the bundled htmlparser2 API from `@tailwindcss-mangle/engine/htmlparser2` for packages that need the same Node.js 18-compatible parser entry.** [`5610e9b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/5610e9bcb49961d3dbb481989359d8e831d01a9d) by @sonofmagic
  - Switch core HTML parsing to the engine-provided htmlparser2 entry instead of depending on htmlparser2 directly.

- 🐛 **Add comprehensive generated large-file benchmarks and speed up JS-like candidate extraction by reusing precomputed string ranges.** [`3fe33fa`](https://github.com/sonofmagic/tailwindcss-mangle/commit/3fe33fa30af8bdec399952f4bc6d884c374c7a2d) by @sonofmagic

- 🐛 **Support Node.js 18.20+ by targeting Node 18 builds and bundling the Vue template HTML parser implementation into the engine package.** [`bd34046`](https://github.com/sonofmagic/tailwindcss-mangle/commit/bd34046f5e6c6f2f283675fd555dbf429d81aced) by @sonofmagic

- 🐛 **Increase the raw candidate LRU cache default limit to 64 entries and add benchmark coverage for cache working-set behavior.** [`8fa8819`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8fa8819b4a978341302bb9f84861be80350ecfd3) by @sonofmagic

- 🐛 **Speed up Vue-like source extraction by using htmlparser2 to read class attributes and scanning only candidate-bearing template, script string, and style @apply segments.** [`06b809c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/06b809ca63116536ceca8d79ec8a7767df4e481a) by @sonofmagic

- 🐛 **Add Vue template language fallback extraction for non-HTML template blocks while keeping the fast htmlparser2 path for regular Vue templates.** [`9d923bb`](https://github.com/sonofmagic/tailwindcss-mangle/commit/9d923bb50659f41e684cecd532f6a60c923f6bd5) by @sonofmagic

## 0.1.0

### Minor Changes

- ✨ **新增独立的 Tailwind CSS 引擎包，承载候选类名提取、Tailwind v3/v4 样式生成、v4 source 扫描与 bare arbitrary value 解析能力。** [#211](https://github.com/sonofmagic/tailwindcss-mangle/pull/211) by @sonofmagic
  - `tailwindcss-patch` 现在通过 `@tailwindcss-mangle/engine` 复用这些能力，并保留原有公共导出兼容性；同时将 Node.js 版本要求提升到 `>=22.13.0`。

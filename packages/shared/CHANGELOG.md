# @tailwindcss-mangle/shared

## 4.1.3

### Patch Changes

- 🐛 **Fix workspace install and e2e stability when package dist artifacts are unavailable during lifecycle scripts.** [`84dcb16`](https://github.com/sonofmagic/tailwindcss-mangle/commit/84dcb1667cbe360c67744f3fd1f53d5c8c45eaae) by @sonofmagic
  - Keep published entry fields for config/shared/tailwindcss-patch pointing to `dist` outputs.
  - Make `tw-patch install` resilient in monorepo installs by avoiding eager config loading and lazily resolving config/shared modules with source fallbacks.
  - Prevent CI install failures caused by module resolution during app `prepare`/`postinstall` hooks.

## 4.1.2

### Patch Changes

- 🐛 **use compiler-aware transforms and stabilize workspace runtime exports** [`a64c0da`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a64c0dae16d0b1d18f6bc88338abe2103b204c4d) by @sonofmagic
  - route included source files to the correct AST handler by file/query language hints
  - avoid webpack html child-compilation transform conflicts and improve filter behavior
  - add app integration e2e coverage for vite/nuxt/astro/next/webpack examples
  - expose workspace package runtime entries from dist for stable next/webpack consumption

## 4.1.1

### Patch Changes

- [`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(patch): add TailwindcssPatcher extract option

  chore(deps): upgrade

## 4.1.0

### Minor Changes

- [`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support tailwindcss@4.1.1

## 4.0.2

### Patch Changes

- [`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump deps and add patch only for tailwindcss v2 and v3

## 4.0.1

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

## 4.0.1-alpha.0

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

## 4.0.0

### Major Changes

- [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm module

## 4.0.0-alpha.0

### Major Changes

- [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm module

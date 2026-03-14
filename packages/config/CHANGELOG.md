# @tailwindcss-mangle/config

## 7.0.0-alpha.1

### Major Changes

- 🚀 **Require modern `tailwindcss-patch` options and an explicit `tailwindcss.version`, removing support for legacy constructor aliases like `cwd`, `tailwind`, `features`, `output`, `overwrite`, and `patch`.** [`f4d9cec`](https://github.com/sonofmagic/tailwindcss-mangle/commit/f4d9cecf1b92acfb9512ef8910ec749bbeb8e61c) by @sonofmagic
  - Workspace registry loading now rejects deprecated `registry.output`, `registry.tailwind`, and `registry.patch` fields. Use `registry.extract`, `registry.tailwindcss`, and `registry.apply` instead.
  - The default generated config now includes `registry.tailwindcss.version = 4`.
  - `@tailwindcss-mangle/config` now types only the modern `registry` shape. Deprecated aliases like `registry.output`, `registry.tailwind`, `tailwindcss.package`, `tailwindcss.legacy`, `tailwindcss.classic`, and `tailwindcss.next` are no longer part of the public type surface.

### Patch Changes

- 🐛 **Restore automatic Tailwind CSS major version detection when `registry.tailwindcss.version` is omitted, while keeping strict validation for explicitly configured versions. This also removes the default config value that forced version `4` during install-time prepare scripts in Tailwind v3 demo apps.** [`c87c9ab`](https://github.com/sonofmagic/tailwindcss-mangle/commit/c87c9ab86dfa083f0f85d688f953d94834b2e293) by @sonofmagic

- 🐛 **Align workspace package metadata with built `dist` outputs and fix config consumption to use the modern `registry.extract.file` fallback. Demo apps now declare the workspace packages they execute or import so Turbo can derive internal build dependencies correctly.** [`b42175f`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b42175f33ab8751c4591c04160261e708c90689c) by @sonofmagic
- 📦 **Dependencies** [`b42175f`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b42175f33ab8751c4591c04160261e708c90689c)
  → `@tailwindcss-mangle/shared@4.1.4-alpha.0`

## 6.1.4-alpha.0

### Patch Changes

- 🐛 **Refresh internal dependency ranges for the published config and core packages, including `fs-extra`, `postcss`, `@vue/compiler-sfc`, and `svelte`, to keep the workspace aligned with the updated toolchain.** [`8937b29`](https://github.com/sonofmagic/tailwindcss-mangle/commit/8937b296f995888d39e4c6714f35e83a9a260fa0) by @sonofmagic

## 6.1.3

### Patch Changes

- 🐛 **Fix workspace install and e2e stability when package dist artifacts are unavailable during lifecycle scripts.** [`84dcb16`](https://github.com/sonofmagic/tailwindcss-mangle/commit/84dcb1667cbe360c67744f3fd1f53d5c8c45eaae) by @sonofmagic
  - Keep published entry fields for config/shared/tailwindcss-patch pointing to `dist` outputs.
  - Make `tw-patch install` resilient in monorepo installs by avoiding eager config loading and lazily resolving config/shared modules with source fallbacks.
  - Prevent CI install failures caused by module resolution during app `prepare`/`postinstall` hooks.
- 📦 **Dependencies** [`84dcb16`](https://github.com/sonofmagic/tailwindcss-mangle/commit/84dcb1667cbe360c67744f3fd1f53d5c8c45eaae)
  → `@tailwindcss-mangle/shared@4.1.3`

## 6.1.2

### Patch Changes

- 🐛 **use compiler-aware transforms and stabilize workspace runtime exports** [`a64c0da`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a64c0dae16d0b1d18f6bc88338abe2103b204c4d) by @sonofmagic
  - route included source files to the correct AST handler by file/query language hints
  - avoid webpack html child-compilation transform conflicts and improve filter behavior
  - add app integration e2e coverage for vite/nuxt/astro/next/webpack examples
  - expose workspace package runtime entries from dist for stable next/webpack consumption
- 📦 **Dependencies** [`a64c0da`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a64c0dae16d0b1d18f6bc88338abe2103b204c4d)
  → `@tailwindcss-mangle/shared@4.1.2`

## 6.1.1

### Patch Changes

- 🐛 **Add modern `defineConfig` registry support and bridge it end-to-end into `tailwindcss-patch`.** [`27c4976`](https://github.com/sonofmagic/tailwindcss-mangle/commit/27c4976173ea650daa417bbf857890feb69630c2) by @sonofmagic
  - extend `@tailwindcss-mangle/config` `RegistryOptions` to support modern fields: `projectRoot`, `tailwindcss`, `apply`, `extract`, `cache`, and `filter`
  - keep legacy `registry.output` and `registry.tailwind` available with deprecation annotations
  - update `initConfig` and default registry shape to include modern `extract`/`tailwindcss` keys
  - update `tailwindcss-patch` unified config mapping to read both modern and legacy registry fields, preferring modern values when both are present

## 6.1.0

### Minor Changes

- [#165](https://github.com/sonofmagic/tailwindcss-mangle/pull/165) [`6799e3b`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6799e3b319ed27f227f698c7971256fc427921f7) Thanks [@Ercilan](https://github.com/Ercilan)! - refine js-related file extension matching

## 6.0.1

### Patch Changes

- [`ba12f2a`](https://github.com/sonofmagic/tailwindcss-mangle/commit/ba12f2afd8321e03d55f9f7b8cd5e60bf93da85d) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Lazy-load `c12` so CommonJS consumers avoid ESM require errors when loading the config helpers.

## 6.0.0

### Major Changes

- [`18a8c3c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/18a8c3c1ef704acd2b68dd93ac31f57d403fd8ed) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Adopt a unified `registry`/`transformer` configuration surface across the toolchain, update runtime consumers and tests to the new API, and refresh docs and examples to match the renamed options.

## 5.1.2

### Patch Changes

- [`6596fae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/6596fae09395e1d92f2dc9244586fe05366aa42b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(tailwindcss-patch): make @tailwindcss/node as dependencies

## 5.1.1

### Patch Changes

- [`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(patch): add TailwindcssPatcher extract option

  chore(deps): upgrade

- Updated dependencies [[`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace)]:
  - @tailwindcss-mangle/shared@4.1.1

## 5.1.0

### Minor Changes

- [`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support tailwindcss@4.1.1

### Patch Changes

- Updated dependencies [[`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019)]:
  - @tailwindcss-mangle/shared@4.1.0

## 5.0.6

### Patch Changes

- [`0651cae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0651cae4e5d3544b5265278a1dfb44d8a4e3f2f8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: downgrade c12 for cjs format

## 5.0.5

### Patch Changes

- [`41dc914`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41dc91418b0d36f85fddf5bfcd078fa1a90986a8) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 5.0.4

### Patch Changes

- [`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump deps and add patch only for tailwindcss v2 and v3

- Updated dependencies [[`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6)]:
  - @tailwindcss-mangle/shared@4.0.2

## 5.0.3

### Patch Changes

- [`e87d048`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e87d048324ca80ccef69902ab45e4d0c993f06fa) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: tw-patch extract error

## 5.0.2

### Patch Changes

- [`78c0297`](https://github.com/sonofmagic/tailwindcss-mangle/commit/78c02972f17865d489e66274086bcf11860689eb) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: add getPackageInfo options

## 5.0.1

### Patch Changes

- [`a8ba17e`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a8ba17e8e676602f8d724ee3b08cc83ad6654192) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: export type and add tailwindcss version config

## 5.0.0

### Major Changes

- [`362bd49`](https://github.com/sonofmagic/tailwindcss-mangle/commit/362bd496d40810b8f69c4789900117f83c9c4692) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat!: add tailwindcss v4 support and change getClassSet return type

  need to install `@tailwindcss/node` and `@tailwindcss/oxide`

  This is a breaking change because it changes the return type of `getClassSet`.

## 4.0.1

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/shared@4.0.1

## 4.0.1-alpha.0

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/shared@4.0.1-alpha.0

## 4.0.0

### Major Changes

- [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm module

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/shared@4.0.0

## 4.0.0-alpha.0

### Major Changes

- [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm module

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2)]:
  - @tailwindcss-mangle/shared@4.0.0-alpha.0

# unplugin-tailwindcss-mangle

## 5.1.1

### Patch Changes

- 🐛 **use compiler-aware transforms and stabilize workspace runtime exports** [`a64c0da`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a64c0dae16d0b1d18f6bc88338abe2103b204c4d) by @sonofmagic
  - route included source files to the correct AST handler by file/query language hints
  - avoid webpack html child-compilation transform conflicts and improve filter behavior
  - add app integration e2e coverage for vite/nuxt/astro/next/webpack examples
  - expose workspace package runtime entries from dist for stable next/webpack consumption
- 📦 **Dependencies** [`076dddd`](https://github.com/sonofmagic/tailwindcss-mangle/commit/076dddd1ad86274a4b32fac4730b6ab6b6f2775e)
  → `@tailwindcss-mangle/core@5.1.1`, `@tailwindcss-mangle/shared@4.1.2`, `@tailwindcss-mangle/config@6.1.2`

## 5.1.0

### Minor Changes

- ✨ **Add AST-based transformation support for Vue SFC, Svelte components, and JSX/TSX using framework-specific compilers. This provides more precise class name mangling for framework-specific files.** [`5ecbf02`](https://github.com/sonofmagic/tailwindcss-mangle/commit/5ecbf02acdcbd1e727a375c880df4805f4082b7b) by @sonofmagic
  **Features:**
  - Vue SFC handler: Parse and transform classes in template, script, and style sections using `@vue/compiler-sfc`
  - Svelte handler: Parse and transform classes in components with support for class directives using `svelte/compiler`
  - JSX/TSX support: Enable Babel `jsx` and `typescript` plugins for proper React component transformation
  - Proper AST traversal for accurate class name replacement in all framework files
  - Comprehensive test coverage for Vue, Svelte, and JSX/TSX transformations

### Patch Changes

- 📦 **Dependencies** [`5ecbf02`](https://github.com/sonofmagic/tailwindcss-mangle/commit/5ecbf02acdcbd1e727a375c880df4805f4082b7b)
  → `@tailwindcss-mangle/core@5.1.0`, `@tailwindcss-mangle/config@6.1.1`

## 5.0.0

### Major Changes

- [`18a8c3c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/18a8c3c1ef704acd2b68dd93ac31f57d403fd8ed) Thanks [@sonofmagic](https://github.com/sonofmagic)! - Adopt a unified `registry`/`transformer` configuration surface across the toolchain, update runtime consumers and tests to the new API, and refresh docs and examples to match the renamed options.

### Patch Changes

- Updated dependencies [[`18a8c3c`](https://github.com/sonofmagic/tailwindcss-mangle/commit/18a8c3c1ef704acd2b68dd93ac31f57d403fd8ed)]:
  - @tailwindcss-mangle/config@6.0.0
  - @tailwindcss-mangle/core@5.0.0

## 4.1.2

### Patch Changes

- [`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(patch): add TailwindcssPatcher extract option

  chore(deps): upgrade

- Updated dependencies [[`b6b84f4`](https://github.com/sonofmagic/tailwindcss-mangle/commit/b6b84f43c083f937e2888a7d680e01ae64f8aace)]:
  - @tailwindcss-mangle/config@5.1.1
  - @tailwindcss-mangle/core@4.1.1
  - @tailwindcss-mangle/shared@4.1.1

## 4.1.1

### Patch Changes

- [`2b91de7`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2b91de7cf94956abad7d128e5a03184305d21294) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: make cache sync and add getClassCacheSetV3 method

## 4.1.0

### Minor Changes

- [`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: support tailwindcss@4.1.1

### Patch Changes

- Updated dependencies [[`0404f90`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0404f90cc10716a84f3137f4c76a58c4c7edf019)]:
  - @tailwindcss-mangle/config@5.1.0
  - @tailwindcss-mangle/core@4.1.0
  - @tailwindcss-mangle/shared@4.1.0

## 4.0.10

### Patch Changes

- Updated dependencies [[`0651cae`](https://github.com/sonofmagic/tailwindcss-mangle/commit/0651cae4e5d3544b5265278a1dfb44d8a4e3f2f8)]:
  - @tailwindcss-mangle/config@5.0.6
  - @tailwindcss-mangle/core@4.0.9

## 4.0.9

### Patch Changes

- Updated dependencies [[`41dc914`](https://github.com/sonofmagic/tailwindcss-mangle/commit/41dc91418b0d36f85fddf5bfcd078fa1a90986a8)]:
  - @tailwindcss-mangle/config@5.0.5
  - @tailwindcss-mangle/core@4.0.8

## 4.0.8

### Patch Changes

- [`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: bump deps and add patch only for tailwindcss v2 and v3

- Updated dependencies [[`034f9f3`](https://github.com/sonofmagic/tailwindcss-mangle/commit/034f9f30ebfee915a564f95e2bf1959e8fbce3e6)]:
  - @tailwindcss-mangle/config@5.0.4
  - @tailwindcss-mangle/core@4.0.7
  - @tailwindcss-mangle/shared@4.0.2

## 4.0.7

### Patch Changes

- [`310d135`](https://github.com/sonofmagic/tailwindcss-mangle/commit/310d1350fbc6b69c184906ff9e8027908c1ea1f1) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: https://github.com/sonofmagic/tailwindcss-mangle/issues/141

## 4.0.6

### Patch Changes

- Updated dependencies [[`e87d048`](https://github.com/sonofmagic/tailwindcss-mangle/commit/e87d048324ca80ccef69902ab45e4d0c993f06fa)]:
  - @tailwindcss-mangle/config@5.0.3
  - @tailwindcss-mangle/core@4.0.6

## 4.0.5

### Patch Changes

- Updated dependencies [[`78c0297`](https://github.com/sonofmagic/tailwindcss-mangle/commit/78c02972f17865d489e66274086bcf11860689eb)]:
  - @tailwindcss-mangle/config@5.0.2
  - @tailwindcss-mangle/core@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [[`a8ba17e`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a8ba17e8e676602f8d724ee3b08cc83ad6654192)]:
  - @tailwindcss-mangle/config@5.0.1
  - @tailwindcss-mangle/core@4.0.4

## 4.0.3

### Patch Changes

- Updated dependencies [[`362bd49`](https://github.com/sonofmagic/tailwindcss-mangle/commit/362bd496d40810b8f69c4789900117f83c9c4692)]:
  - @tailwindcss-mangle/config@5.0.0
  - @tailwindcss-mangle/core@4.0.3

## 4.0.2

### Patch Changes

- Updated dependencies [[`ba35630`](https://github.com/sonofmagic/tailwindcss-mangle/commit/ba3563015630cddd38eb188493878852ceb026a4)]:
  - @tailwindcss-mangle/core@4.0.2

## 4.0.1

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1
  - @tailwindcss-mangle/core@4.0.1
  - @tailwindcss-mangle/shared@4.0.1

## 4.0.1-alpha.0

### Patch Changes

- [`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83) Thanks [@sonofmagic](https://github.com/sonofmagic)! - fix: build dist empty issue

- Updated dependencies [[`a529a71`](https://github.com/sonofmagic/tailwindcss-mangle/commit/a529a71a74faed4c699d164ae66ce68e87096e83)]:
  - @tailwindcss-mangle/config@4.0.1-alpha.0
  - @tailwindcss-mangle/core@4.0.1-alpha.0
  - @tailwindcss-mangle/shared@4.0.1-alpha.0

## 4.0.0

### Major Changes

- [`23badf9`](https://github.com/sonofmagic/tailwindcss-mangle/commit/23badf9e58f8e13f422ad406435eff1e8d8ae823) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3)]:
  - @tailwindcss-mangle/config@4.0.0
  - @tailwindcss-mangle/shared@4.0.0
  - @tailwindcss-mangle/core@4.0.0

## 4.0.0-alpha.0

### Major Changes

- [`23badf9`](https://github.com/sonofmagic/tailwindcss-mangle/commit/23badf9e58f8e13f422ad406435eff1e8d8ae823) Thanks [@sonofmagic](https://github.com/sonofmagic)! - feat: prefer esm

### Patch Changes

- Updated dependencies [[`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`6879782`](https://github.com/sonofmagic/tailwindcss-mangle/commit/68797825a08d4b4d15073024a257a3ec336187d2), [`2575863`](https://github.com/sonofmagic/tailwindcss-mangle/commit/2575863f532731c3a38bd2e8463f41031bc6efd3)]:
  - @tailwindcss-mangle/config@4.0.0-alpha.0
  - @tailwindcss-mangle/shared@4.0.0-alpha.0
  - @tailwindcss-mangle/core@4.0.0-alpha.0

## 3.0.1

### Patch Changes

- 36bd52c: support nextjs app

## 2.3.0

### Minor Changes

- 3c2d2b9: fix(tailwindcss-patch): monorepo basedir option

### Patch Changes

- Updated dependencies [3c2d2b9]
  - @tailwindcss-mangle/core@2.3.0

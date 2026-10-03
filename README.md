# tailwindcss-mangle

![star](https://badgen.net/github/stars/sonofmagic/tailwindcss-mangle)
![dm0](https://badgen.net/npm/dm/@tailwindcss-mangle/core)
![dm1](https://badgen.net/npm/dm/@tailwindcss-mangle/shared)
![dm2](https://badgen.net/npm/dm/tailwindcss-patch)
![dm3](https://badgen.net/npm/dm/unplugin-tailwindcss-mangle)
[![test](https://github.com/sonofmagic/tailwindcss-mangle/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/sonofmagic/tailwindcss-mangle/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/sonofmagic/tailwindcss-mangle/branch/main/graph/badge.svg?token=jPyNihT78U)](https://codecov.io/gh/sonofmagic/tailwindcss-mangle)

A util for mangle tailwindcss

- [tailwindcss-mangle](#tailwindcss-mangle)
  - [tailwindcss-patch](#tailwindcss-patch)
  - [unplugin-tailwindcss-mangle](#unplugin-tailwindcss-mangle)
  - [Contributing](#contributing)

## tailwindcss-patch

`tailwindcss-patch` is a util to patch tailwindcss code and get its context at runtime.

Click [tailwindcss-patch](./packages/tailwindcss-patch) for more details.

## unplugin-tailwindcss-mangle

> It is recommended to read the documentation of [tailwindcss-patch](https://github.com/sonofmagic/tailwindcss-mangle/tree/main/packages/tailwindcss-patch) first, `unplugin-tailwindcss-mangle` depends on this tool.

`unplugin-tailwindcss-mangle` is a plugin for `webpack` and `vite` to **obfuscate** tailwindcss class.

You can enter [unplugin-tailwindcss-mangle](./packages/unplugin-tailwindcss-mangle) for usage and more details.

### NextJs

For users trying version `2.3.0` of `unplugin-tailwindcss-mangle`, it has been tested and confirmed to work in versions `14~15`. However, be aware that this package is no longer maintained, as the project is focused on `vitejs`.

## Contributing

Use Node.js 22.22.1 or newer and pnpm 12.8.1. The workspace uses [repoctl](https://github.com/icelib/repoctl) for shared tooling and release management.

```sh
pnpm install
pnpm build
pnpm lint
pnpm lint:style
pnpm typecheck
pnpm test:types
pnpm test
pnpm build:docs
```

Install Chromium with `pnpm exec playwright install chromium` before running `pnpm test:e2e:all`. On Linux, install browser system dependencies with `pnpm exec playwright install-deps chromium`. These suites cover framework builds, browser output, and HMR. Tailwind CSS 2/3/4 fixtures and the engine's Node 18 runtime compatibility are maintained independently of the development toolchain.

Dependency upgrades retain these compatibility constraints:

- TypeScript stays on 6.0.3 until repoctl, typescript-eslint, and Svelte's checker support TypeScript 7.
- The Remix 2 example keeps React 18, TypeScript 5, ESLint 8, and Vite 6. The NextUI example keeps the final compatible releases under the original package names.
- Tailwind 2/PostCSS 7 and Tailwind 3 use separate catalogs and aliases. Historical version fixtures are intentionally fixed; they must not be included in bulk upgrades.
- Version-specific overrides in `pnpm-workspace.yaml` align upstream peer dependency families. Recheck them with `pnpm peers check` when upgrading their parent packages.

For a publishable package change, run `pnpm change` to add a change intent and `pnpm release:plan` to inspect the release plan. The managed release workflow prepares Release PRs and publishes their merged versions. See the [release policy](./docs/release/release-group-policy.md) for validation and prerelease commands.

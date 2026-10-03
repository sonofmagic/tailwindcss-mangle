# Repository Guidelines

## Environment Setup

Use Node.js 22.22.1 or newer and the pinned pnpm 12.8.1 version from `packageManager`. Run `pnpm install` from the repo root to link workspace packages and install Git hooks. Repository tooling is configured through `repoctl.config.ts` and the public `repoctl` package; do not add direct dependencies on the legacy `@icebreakers/monorepo` CLI or individual Icebreakers config packages.

App prepare scripts apply local `tw-patch` and Nuxt setup only when their built workspace dependencies are ready. Keep their CI and `TWM_SKIP_*` guards. Build packages before running integration tests. The engine separately supports Node.js 18.20; its runtime support must not inherit the repository toolchain minimum.

## Project Structure & Module Organization

Source lives in `packages/`, with `@tailwindcss-mangle/core` providing class transformation, `engine` handling candidate extraction and style generation, `shared` providing cross-package utilities, `config` providing preset defaults, `tailwindcss-patch` exposing the CLI/runtime, and `unplugin-tailwindcss-mangle` providing build-tool integrations. Example applications live under `apps/`, while `website/` hosts the Next.js/Nextra documentation. Reusable scripts live in `scripts/`, and assets used by docs and samples are under `assets/`.

## Build, Test, and Development Commands

- `pnpm dev`: start package-level dev modes across the workspace (e.g., watch builds).
- `pnpm build`: build every library in `packages/*` in dependency order.
- `pnpm build:docs`: build the Next.js/Nextra documentation and Pagefind index.
- `pnpm lint` and `pnpm lint:style`: run the shared repoctl lint configuration.
- `pnpm typecheck` and `pnpm test:types`: validate package source and published type contracts.
- `pnpm test:e2e:all`: run app build, browser, and HMR suites.
- `pnpm script:clean`: remove generated package and application artifacts.
- `pnpm release:plan`: inspect the release plan without preparing or publishing a release.

## Coding Style & Naming Conventions

The codebase is TypeScript-first with strict ESM modules. ESLint, Stylelint, Commitlint, lint-staged, and Vitest consume the repoctl presets. Keep repository-specific aliases, exclusions, and rule overrides in the local configuration. Prefer PascalCase for exported classes (e.g., `ClassGenerator`) and camelCase for functions and variables. Keep filenames lowercase with dashes or dots (`css/index.ts`, `test/utils.ts`).

## AI Code Gate

Any AI-generated code must satisfy the same quality gate as human-written code before it is considered complete:

- `pnpm lint`
- `pnpm lint:style`
- package-specific `pnpm test:types` when the touched package exposes public types
- run the relevant TypeScript validation for the touched project
  - package/library code: package `tsc` / `vitest` / `pnpm test:types`
  - framework apps: the app's own `build` or framework-specific typecheck command

AI-generated changes should update local ignores or test/config scopes only when the reported files are not first-party source files (for example generated assets, snapshots, or fixtures). Do not bypass real source errors by weakening lint/type/style rules.

## Testing Guidelines

Vitest drives unit tests via `vitest.config.ts` and package configurations, discovering suites inside each package's `test/` directory. Name files `*.test.ts` and keep snapshots in `__snapshots__/`. Build first because published-runtime tests load `dist`. Run the full suite with `pnpm test`; use `pnpm test:dev` for watch mode, or filter with `pnpm --filter @tailwindcss-mangle/core test`. Preserve the Tailwind 2, 3, and 4 compatibility fixtures and the engine's Node 18 smoke test. Browser suites run headless; HMR tests restore edited application sources and release their browsers and servers.

## Commit & Pull Request Guidelines

Follow Conventional Commits enforced by Commitlint (e.g., `feat(core): add selector mangling`). Group related changes per package and mention affected workspace names in the scope. Open pull requests with a concise summary, testing notes, and links to any tracking issues. Include screenshots or CLI output when altering developer tooling or docs. Record changes to publishable packages with a native pnpm change intent (`pnpm change` or `pnpm release`) in `.changeset/`; private apps and the documentation site are not release units.

## Release & Automation Notes

repoctl orchestrates releases through the managed `release/v2` workflow and `repo release ci`. pnpm owns versioning, changelogs, and intent consumption. `.changeset/` retains change intents and release history; do not recreate the removed Changesets `config.json` or add `changesets/action`. Use `pnpm release:plan` for read-only validation, not a release CI invocation. Run `pnpm release:verify` before release preparation; only the release workflow should prepare Release PRs or publish packages during ordinary development. See `docs/release/release-group-policy.md` for release and compatibility requirements. Renovate keeps dependencies current; document intentional compatibility pins.

# Repository Guidelines

## Environment Setup
Use Node.js 18 or newer and install dependencies with `pnpm` (enforced by `preinstall`). Run `pnpm install` from the repo root to link workspace packages and set up local post-install patches via `tw-patch`.

## Project Structure & Module Organization
Source lives in `packages/`, with `@tailwindcss-mangle/core` providing the transformation engine, `shared` for cross-package utils, `config` for preset defaults, `tailwindcss-patch` to shim Tailwind versions, and `unplugin-tailwindcss-mangle` for build-tool integrations. Example applications live under `apps/` for framework-specific smoke tests, while `website/` hosts the Astro-powered docs. Reusable scripts live in `scripts/`, and assets used by docs and samples are under `assets/`.

## Build, Test, and Development Commands
- `pnpm dev`: start package-level dev modes across the workspace (e.g., watch builds).
- `pnpm build`: run Turbo builds for every package in `packages/*`.
- `pnpm build:docs`: build the Astro documentation site in `website/`.
- `pnpm lint`: apply ESLint fixes across TypeScript sources.
- `pnpm script:clean`: remove generated artifacts via the monorepo helper.

## Coding Style & Naming Conventions
The codebase is TypeScript-first with strict ESM modules. Formatting is handled by the shared `@icebreakers/eslint-config` and Prettier defaults (2-space indentation, semicolons omitted). Prefer PascalCase for exported classes (e.g., `ClassGenerator`) and camelCase for functions and variables. Keep filenames lowercase with dashes or dots (`css/index.ts`, `test/utils.ts`).

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
Vitest drives unit tests via `vitest.config.ts`, discovering suites inside each package’s `test/` directory. Name files `*.test.ts` and keep snapshots in `__snapshots__/`. Run the full suite with `pnpm test`; use `pnpm test:dev` for focused watch mode, or filter with `pnpm --filter @tailwindcss-mangle/core test`. Coverage is enabled by default and stored in `coverage/` directories.

## Commit & Pull Request Guidelines
Follow Conventional Commits enforced by Commitlint (e.g., `feat(core): add selector mangling`). Group related changes per package and mention affected workspace names in the scope. Open pull requests with a concise summary, testing notes, and links to any tracking issues. Include screenshots or CLI output when altering developer tooling or docs. Use Changesets (`pnpm release`) when preparing published releases.

## Release & Automation Notes
Changesets orchestrate versioning (`pnpm publish-packages`). Turbo caches builds, so clear with `pnpm script:clean` if results look stale. Renovate keeps dependencies current; note any pinning decisions in the PR description.

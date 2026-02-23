# Packages Architecture Optimization Plan (2 Weeks)

## Goal

Stabilize package boundaries and runtime behavior across workspace install, CI, and app E2E builds while reducing cross-package coupling in `packages/*`.

## Scope

- `packages/shared`
- `packages/config`
- `packages/core`
- `packages/tailwindcss-patch`
- `packages/unplugin-tailwindcss-mangle`
- E2E harness currently in `packages/unplugin-tailwindcss-mangle/test`

---

## Guiding Constraints

1. Keep published package behavior stable.
2. Minimize install-time side effects.
3. Avoid `src` entry assumptions in app build pipelines.
4. Every PR must have an explicit rollback path.

---

## PR Plan

### PR1: Lock Entry Strategy and Install-Path Safety

#### Changes

- Keep package exports/main/module for workspace and publish aligned to `dist` for:
  - `packages/shared/package.json`
  - `packages/config/package.json`
  - `packages/core/package.json`
  - `packages/unplugin-tailwindcss-mangle/package.json`
  - `packages/tailwindcss-patch/package.json`
- Keep `tw-patch install` path independent from full config loading:
  - Ensure install command uses minimal runtime patch path.
  - Lazy-load config/shared modules where config-dependent commands require them.

#### Validation

- Simulate no-`dist` install path for relevant packages.
- Run:
  - `pnpm build`
  - `pnpm test:e2e`
  - `pnpm --filter tailwindcss-patch test`

#### Risk

- Install behavior divergence between commands (`install` vs `extract`/`tokens`).

#### Rollback

- Revert CLI lazy-loading commit only; keep entry strategy unchanged.

---

### PR2: Enforce Package Dependency Boundaries

#### Changes

- Add boundary rules (ESLint or dep graph check):
  - `shared` cannot depend on Node runtime I/O or patching concerns.
  - `config` cannot depend on plugin adapters.
  - `core` cannot depend on `tailwindcss-patch` CLI internals.
  - `unplugin` can depend only on `core/config/shared`.
- Add CI check task for boundary validation.

#### Validation

- Run lint + boundary check in CI.
- Ensure existing package build and tests remain green.

#### Risk

- Existing imports may violate new policy and fail CI immediately.

#### Rollback

- Keep rule files but disable strict mode in CI until cleanup PR lands.

---

### PR3: Split `tailwindcss-patch` Internal Responsibilities

#### Changes

- Refactor internal structure into clear modules:
  - `src/install/*` for install-only runtime patch.
  - `src/config/*` for config loading and normalization bridge.
  - `src/commands/*` for command implementations.
- Keep external API and CLI interface unchanged.

#### Validation

- Snapshot/contract tests for CLI output and exit codes.
- Existing tailwindcss-patch unit tests.

#### Risk

- Behavioral regressions in command wiring.

#### Rollback

- Revert only module move commit; preserve any independent bug fixes.

---

### PR4: Move Monorepo E2E to Top-Level `e2e/`

#### Changes

- Move cross-app integration suites from:
  - `packages/unplugin-tailwindcss-mangle/test/apps.e2e.*`
  - to `e2e/apps/*`
- Keep package-local unit tests in package directories.
- Add root scripts:
  - `test:e2e:apps`
  - `test:e2e:apps:pw`

#### Validation

- Ensure e2e scripts run from repo root without package coupling assumptions.

#### Risk

- Script path breakage in CI workflows.

#### Rollback

- Keep old test entrypoints as compatibility shims for one release cycle.

---

### PR5: Release Group and Versioning Policy

#### Changes

- Define release group policy for tightly coupled packages:
  - `shared`, `config`, `core`, `tailwindcss-patch`, `unplugin-tailwindcss-mangle`
- Add release checklist in repository docs:
  - required tests
  - changeset scope expectations
  - compatibility notes

#### Validation

- Dry-run with changeset and release workflow.

#### Risk

- Over-releasing packages if policy is too strict.

#### Rollback

- Relax group policy to advisory mode while keeping checklist.

---

## Execution Order

1. PR1 (stability baseline)
2. PR2 (prevent regression)
3. PR3 (internal maintainability)
4. PR4 (testing clarity)
5. PR5 (release governance)

---

## Success Criteria

1. `pnpm build` and `pnpm test:e2e` pass consistently on fresh clones.
2. No install-time module resolution failures in release CI.
3. Package dependency direction is machine-checked.
4. Cross-app E2E no longer depends on a single package test directory.

---

## Progress Update (2026-02-23)

- [x] PR2 implemented:
  - Added `scripts/check-package-boundaries.mjs`.
  - Added root command `pnpm check:boundaries`.
  - Wired CI (`.github/workflows/ci.yml`) to run boundary checks before build/test.
  - Added integration docs for boundary rules and usage in both English and Chinese docs.
- [x] PR3 implemented:
  - Moved CLI internals from `src/cli/*` to `src/commands/*` with compatibility re-export shims.
  - Added `src/config/*` bridge modules for workspace config loading and option normalization integration.
  - Added `src/install/*` bridge modules to consolidate runtime patch/apply/status entrypoints.
  - Updated internal imports to use the new `commands/config/install` layers while keeping public API stable.
  - Validation passed with `pnpm --filter tailwindcss-patch test`, `pnpm check:boundaries`, and `pnpm build`.
- [x] PR4 implemented:
  - Promoted cross-app E2E suites to top-level `e2e/`:
    - `e2e/apps.e2e.shared.ts`
    - `e2e/apps.e2e.test.ts`
    - `e2e/apps.playwright.e2e.test.ts`
    - `e2e/vitest.config.ts`
  - Added root scripts:
    - `pnpm test:e2e:apps`
    - `pnpm test:e2e:apps:pw`
  - Updated `pnpm test:e2e` and `pnpm test:e2e:pw` to delegate to the new top-level suites.
  - Kept package-local compatibility shims under `packages/unplugin-tailwindcss-mangle/test/apps.*`.
  - Validation passed with `pnpm test:e2e`, `pnpm --filter unplugin-tailwindcss-mangle test:e2e`, `pnpm --filter unplugin-tailwindcss-mangle test`, `pnpm check:boundaries`, and `pnpm build`.
- [x] PR5 implemented:
  - Added release governance document: `docs/release/release-group-policy.md`.
  - Defined the tightly coupled release group and corresponding versioning rules.
  - Added release + compatibility checklists aligned with boundary/build/test/e2e flows.
  - Verified changeset release scope visibility using `pnpm changeset status`.

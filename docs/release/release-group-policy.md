# Release Group Policy

## Scope

The following packages are treated as a tightly-coupled release group:

- `@tailwindcss-mangle/shared`
- `@tailwindcss-mangle/config`
- `@tailwindcss-mangle/core`
- `@tailwindcss-mangle/engine`
- `tailwindcss-patch`
- `unplugin-tailwindcss-mangle`

## Why This Group Exists

These packages share runtime contracts across extraction, mapping, transformation, and build-tool integration. Releasing one package in isolation can cause behavior drift for:

- workspace installs before all `dist` artifacts are rebuilt
- plugin/runtime protocol compatibility (`registry`, map output, token flow)
- monorepo E2E fixture expectations

## Versioning Rules

1. If a package in the group changes public API, runtime behavior, or generated artifact format, evaluate all group members for compatibility impact.
2. If compatibility assumptions change across package boundaries, include all affected group packages in the same release batch.
3. Use native pnpm change intents (`pnpm change`) to make coupling explicit in release notes. pnpm also propagates workspace dependency changes.
4. For internal refactors without behavior changes, limit version bumps to touched packages, but still run the full group validation checklist.

## Release Checklist

Run from the repository root before release preparation:

1. `pnpm lint` and `pnpm lint:style`
2. `pnpm check:boundaries`
3. `pnpm build`
4. `pnpm typecheck` and `pnpm test:types`
5. `pnpm test`
6. `pnpm build:docs`
7. `pnpm test:e2e:all`
8. `pnpm release:plan`

Install Playwright Chromium before running browser tests (`pnpm exec playwright install chromium`, plus `pnpm exec playwright install-deps chromium` on Linux). Run the validation gate and then inspect the release plan with:

```sh
pnpm run release:verify
pnpm release:plan
```

`release:plan` runs `repo release plan --json`. It is the read-only release validation command; `repo release ci` and release preparation can update release state and are not local validation substitutes.

## Release Automation

The managed `release/v2` workflow uses repoctl to create or update a Release PR from native pnpm intents. Merging that PR publishes its versions, Git tags, and GitHub Releases. pnpm owns the version plan, changelogs, and `.changeset/ledger.yaml`; keep historical intents and the ledger in version control. There is no Changesets CLI or `config.json`.

The workflow uses Node.js 24, the repository's pinned pnpm version, and npm with trusted publishing support. Configure npm trusted publishing for this repository and `.github/workflows/release.yml`. GitHub metadata uses either a GitHub App (`REPOCTL_APP_CLIENT_ID` and `REPOCTL_APP_PRIVATE_KEY` together), `REPOCTL_RELEASE_TOKEN`, or the workflow token. The legacy `CHANGESETS_RELEASE_TOKEN` remains a token fallback for existing repository settings. The workflow retains partial publish progress as an artifact for recovery.

Use `pnpm exec repo release pre enter <tag>` and `pnpm exec repo release pre exit` to manage the supported `alpha`, `beta`, `rc`, and `next` lanes. Commit lane changes to `pnpm-workspace.yaml` before pushing the corresponding branch. Release preparation and publishing are handled by the workflow, rather than by additional shell-based release steps.

## Compatibility Checklist

Before finalizing a release PR:

1. Confirm workspace runtime imports are still aligned to `dist` entrypoints for grouped packages.
2. Confirm `tailwindcss-patch` install path remains usable without requiring prebuilt workspace `dist`.
3. Confirm app fixtures under `apps/` still produce non-empty mappings and corresponding CSS selectors.
4. Confirm no package boundary regressions are introduced by new cross-package imports.
5. Preserve Tailwind CSS 2/3/4 compatibility fixtures and their major-version aliases when updating dependencies.
6. Run the engine's Node.js 18.20.8 smoke test against built artifacts. Its runtime minimum remains separate from the Node.js 22.22.1 development toolchain.

# Release Group Policy

## Scope

The following packages are treated as a tightly-coupled release group:

- `@tailwindcss-mangle/shared`
- `@tailwindcss-mangle/config`
- `@tailwindcss-mangle/core`
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
3. Use Changesets to make coupling explicit in release notes instead of implicit transitive bumps.
4. For internal refactors without behavior changes, limit version bumps to touched packages, but still run the full group validation checklist.

## Release Checklist

Run from repository root before `changeset publish`:

1. `pnpm check:boundaries`
2. `pnpm build`
3. `pnpm test`
4. `pnpm test:e2e`
5. Optional but recommended for browser/runtime parity: `pnpm run test:e2e:apps:pw`
6. `pnpm changeset status`

You can run the required non-browser checks via:

```sh
pnpm run release:verify
```

## Compatibility Checklist

Before finalizing a release PR:

1. Confirm workspace runtime imports are still aligned to `dist` entrypoints for grouped packages.
2. Confirm `tailwindcss-patch` install path remains usable without requiring prebuilt workspace `dist`.
3. Confirm app fixtures under `apps/` still produce non-empty mappings and corresponding CSS selectors.
4. Confirm no package boundary regressions are introduced by new cross-package imports.

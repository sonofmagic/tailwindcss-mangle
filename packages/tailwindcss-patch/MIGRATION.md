# Migration Guide

This document describes the changes introduced by the full refactor of `tailwindcss-patch`. It helps teams upgrading from the 7.x line (or earlier) to the new architecture.

> TL;DR — the public API now revolves around the `TailwindcssPatcher` class, helpers live in explicit folders, and the CLI exposes clearer options. v9 is modern-only: migrate deprecated config fields before upgrading.

## 1. Package layout

| Before                                                 | After                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/core/**` mix of cache, patch and runtime helpers  | Dedicated folders: `api/`, `cache/`, `patching/`, `runtime/`, `options/`, `extraction/` |
| `CacheManager`, `InternalPatchOptions`, ad-hoc exports | `CacheStore`, `normalizeOptions`, typed helpers with explicit imports                   |
| `processTailwindcss`                                   | `runTailwindBuild` in `runtime/process-tailwindcss.ts`                                  |

Imports such as `@/core/patcher` or `@/core/cache` must be updated. Use the new entry-points:

```ts
import { TailwindcssPatcher } from 'tailwindcss-patch'
import { CacheStore } from 'tailwindcss-patch/cache/store'
import { applyTailwindPatches } from 'tailwindcss-patch/patching/patch-runner'
```

## 2. TailwindcssPatcher options

### Previous shape

```ts
const patcher = new TailwindcssPatcher({
  cache: { dir: '.cache', file: 'classes.json' },
  patch: {
    overwrite: true,
    output: { filename: '.tw-patch/tw-class-list.json', loose: true },
    tailwindcss: { version: 3, v3: { cwd, config } },
    applyPatches: { extendLengthUnits: true },
  },
})
```

### New shape

```ts
const patcher = new TailwindcssPatcher({
  projectRoot: process.cwd(),
  cache: {
    enabled: true,
    dir: '.tw-patch/cache',
    strategy: 'merge',
  },
  extract: {
    write: true,
    file: '.tw-patch/tw-class-list.json',
    format: 'json',
    removeUniversalSelector: true,
  },
  apply: {
    overwrite: true,
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: { units: ['rpx'] },
  },
  tailwindcss: {
    version: 4,
    v4: {
      base: './src',
      cssEntries: ['dist/tailwind.css'],
    },
  },
})
```

Legacy constructor aliases are no longer accepted in v9.

### Type names

The alpha line now only exposes the modern public option type names. Historical aliases were removed instead of being kept with `@deprecated`.

Use these names in user code:

- `TailwindCssPatchOptions`
- `TailwindCssOptions`
- `TailwindV2V3Options`
- `TailwindV4Options`
- `ApplyOptions`
- `ExtractOptions`
- `CacheOptions`
- `ExposeContextOptions`
- `ExtendLengthUnitsOptions`
- `NormalizedTailwindCssPatchOptions`

Removed type names:

- `TailwindcssPatchOptions`
- `NormalizedTailwindcssPatchOptions`
- `TailwindLocatorOptions`
- `TailwindNextOptions`
- `TailwindTargetOptions`

If your code imported the removed names, switch imports to the modern names before adopting the current alpha builds.

Migration mapping:

- `cwd` -> `projectRoot`
- `overwrite` -> `apply.overwrite`
- `tailwind` -> `tailwindcss`
- `features` -> `apply`
- `output` -> `extract`

If you still have legacy fields, run `tw-patch migrate --dry-run` first, then apply the rewritten config before upgrading.

### Quick config diff

```ts
// before
export default defineConfig({
  registry: {
    output: {
      file: '.tw-patch/tw-class-list.json',
    },
    tailwind: {
      package: 'tailwindcss',
      classic: {
        cwd: 'apps/web',
      },
    },
  },
})

// after
export default defineConfig({
  registry: {
    extract: {
      file: '.tw-patch/tw-class-list.json',
    },
    tailwindcss: {
      version: 3,
      packageName: 'tailwindcss',
      v3: {
        cwd: 'apps/web',
      },
    },
  },
})
```

## 3. CLI changes

- `tw-patch install` still applies the runtime patch, but logging and error handling were refreshed.
- `tw-patch extract` gained new flags (`--output`, `--format`, `--no-write`, `--css`).
- `tw-patch migrate` can rewrite deprecated config keys to modern fields (`--dry-run` for preview, `--workspace` for recursive monorepo scans, `--check` for CI enforcement).
- Migration writes are transactional by default: if one file write fails, previously written migration files are rolled back.
- Optional `--backup-dir` can persist per-file pre-migration snapshots for manual recovery or auditing.
- `--include` / `--exclude` patterns can narrow workspace migration scope, and `--report-file` can persist machine-readable migration reports.
- `tw-patch restore` can restore config files from a migration report (`backupFile` entries) with optional `--dry-run`, `--strict`, and `--json`.
- Migration reports now include envelope metadata: `reportKind`, `schemaVersion`, `generatedAt`, and `tool` (`name` / `version`).
- `tw-patch restore` validates report metadata when present, rejects unknown kinds/newer schema versions, and keeps legacy metadata-free reports backward compatible.
- `tw-patch restore --json` now exposes report metadata fields (`reportKind`, `reportSchemaVersion`) when available for easier diagnostics.
- `tw-patch validate` can validate migration report compatibility in dry-run mode without restoring files.
- `tw-patch validate` now uses dedicated failure exit codes for CI diagnostics (`21`/`22`/`23`/`24`).
- `tw-patch validate --json` now emits a stable discriminated payload (`ok: true` success / `ok: false` failure with `reason` + `exitCode`), covered by `tailwindcss-patch/validate-result.schema.json`.
- A ready-to-use GitHub Actions example is available at `packages/tailwindcss-patch/examples/github-actions/validate-migration-report.yml`.
- A matrix-based monorepo GitHub Actions example is available at `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-matrix.yml`.
- An affected-shards monorepo GitHub Actions example (PR diff aware) is available at `packages/tailwindcss-patch/examples/github-actions/validate-migration-report-affected.yml`.
- The three templates share a local composite action: `packages/tailwindcss-patch/examples/github-actions/actions/validate-migration-report/action.yml`.
- The shared composite action supports optional setup/install inputs (`setup-pnpm`, `setup-node`, `node-version`, `cache-dependency-path`, `install-deps`, `install-command`) for reusable CI bootstrapping.
- The affected-shards template resolver is externalized at `packages/tailwindcss-patch/examples/github-actions/scripts/resolve-shards.mjs` for testability.
- Resolver JSON contract is documented via `packages/tailwindcss-patch/examples/github-actions/resolve-shards-result.schema.json` with dispatch snapshot fixture `packages/tailwindcss-patch/examples/github-actions/resolve-shards-result.dispatch.snapshot.json`.
- The affected-shards template supports repo-level shard config via `.tw-patch/ci-shards.json` (example: `packages/tailwindcss-patch/examples/github-actions/ci-shards.example.json`).
- README/README-cn now include a CI copy checklist and troubleshooting notes for local action wiring and common failure modes.
- Migration report tooling now has public exports from package entry (`migrateConfigFiles`, `restoreConfigFiles`, report constants/types) and published JSON schema subpaths: `tailwindcss-patch/migration-report.schema.json`, `tailwindcss-patch/restore-result.schema.json`, `tailwindcss-patch/validate-result.schema.json`.
- Commands resolve configuration from `tailwindcss-patch.config.ts` via `@tailwindcss-mangle/config`. Upgrade configs to the modern `registry` shape before moving to v9.

## 4. Cache handling

`CacheManager` has been replaced by `CacheStore`:

```ts
const cache = new CacheStore(normalized.cache)
await cache.write(new Set(['text-lg']))
const values = await cache.read()
```

This ensures consistent async behaviour and reliable error recovery (invalid JSON files are removed automatically).

Starting from the cache governance update, the on-disk cache also moved to **schema v2**:

- `index.json` style payload with `schemaVersion` and per-context entries.
- Context fingerprint includes cwd/config/package/version/options metadata.
- Legacy array files are still readable, but treated as cache-miss and lazily rebuilt.
- `TailwindcssPatcher#clearCache()` can clear current-context (default) or all contexts.

This preserves cache-file compatibility while preventing cross-project cache pollution in monorepos.

## 5. Exported helpers

- Runtime context access now lives in `runtime/context-registry.ts` (`loadRuntimeContexts`).
- Tailwind v4 candidate extraction moved to `extraction/candidate-extractor.ts`.
- Custom unit support is available from `patching/operations/extend-length-units.ts`.

Update imports accordingly when consuming these helpers directly.

## 6. Configuration advice

`defineConfig` from `tailwindcss-patch` (provided by `@tailwindcss-mangle/config`) now describes the modern `registry` shape only. Legacy aliases such as `registry.output`, `registry.tailwind`, `tailwindcss.package`, `tailwindcss.legacy`, `tailwindcss.classic`, and `tailwindcss.next` are migration-only inputs and should be rewritten before v9 rollout.

## 7. Feature highlights

- Tailwind v4 is supported without monkey patching. Provide CSS entries and content sources to `tailwindcss.v4` and call `extract()`.
- Custom length units patching (`extendLengthUnits`) now supports Tailwind v3 and v4 with a single option object.
- Filters are composed with the `extract.removeUniversalSelector` flag so `'*'` can be kept when desired.

## 8. Removal summary

- The entire `src/core/**` directory was removed. Update imports to their new locations.
- `defaults.ts`, `InternalPatchOptions`, and related helpers were removed.
- Old tests referencing `CacheManager` or `processTailwindcss` no longer apply.

## 9. Checklist for upgrading projects

1. Run `tw-patch migrate --dry-run` and inspect every reported config rewrite.
2. Rewrite or migrate all config files to modern `registry.extract`, `registry.apply`, and `registry.tailwindcss` fields.
3. Set `registry.tailwindcss.version` explicitly in every project config.
4. Update custom imports from `tailwindcss-patch/core/*` to the new module paths.
5. If you instantiate the patcher manually, switch to the modern constructor shape.
6. Refresh CLI usage in scripts and rerun `tw-patch install`.
7. For Tailwind v4 projects, configure `tailwindcss.v4.cssEntries` and `sources` so `extract()` can discover candidates.
8. Run extraction in each project and compare the generated class list with the pre-upgrade output.

For any regressions or gaps discovered during migration, please open an issue with reproduction details so we can iterate quickly.

# Migration Guide

This document describes the changes introduced by the full refactor of `tailwindcss-patch`. It helps teams upgrading from the 7.x line (or earlier) to the new architecture.

> TL;DR — the public API now revolves around the `TailwindcssPatcher` class, helpers live in explicit folders, and the CLI exposes clearer options. Legacy configuration objects are still accepted, but adopting the new structure unlocks additional features.

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

Both shapes are accepted. When the constructor detects `patch`/`cache` keys it automatically converts them via `fromLegacyOptions()`. This allows step-by-step migrations.

Deprecated fields (planned removal in the next major): `cwd`, `overwrite`, `tailwind`, `features`, `output`.

Migration mapping:
- `cwd` -> `projectRoot`
- `overwrite` -> `apply.overwrite`
- `tailwind` -> `tailwindcss`
- `features` -> `apply`
- `output` -> `extract`

`normalizeOptions` now emits a one-time runtime warning when deprecated fields are detected.

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
- Commands resolve configuration from `tailwindcss-patch.config.ts` via `@tailwindcss-mangle/config`. Existing configuration files continue to work without changes.

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

This keeps public APIs backward compatible while preventing cross-project cache pollution in monorepos.

## 5. Exported helpers

- Runtime context access now lives in `runtime/context-registry.ts` (`loadRuntimeContexts`).
- Tailwind v4 candidate extraction moved to `extraction/candidate-extractor.ts`.
- Custom unit support is available from `patching/operations/extend-length-units.ts`.

Update imports accordingly when consuming these helpers directly.

## 6. Configuration advice

`defineConfig` from `tailwindcss-patch` (provided by `@tailwindcss-mangle/config`) still emits the legacy `patch` object. The patcher normalizer maps it to the modern runtime shape (`tailwindcss`, `apply`, `extract`) automatically, so migration can be gradual.

If you want the new structure inside application code, prefer creating the patcher manually and pass the modern object as demonstrated above.

## 7. Feature highlights

- Tailwind v4 is supported without monkey patching. Provide CSS entries and content sources to `tailwindcss.v4` and call `extract()`.
- Custom length units patching (`extendLengthUnits`) now supports Tailwind v3 and v4 with a single option object.
- Filters are composed with the `extract.removeUniversalSelector` flag so `'*'` can be kept when desired.

## 8. Removal summary

- The entire `src/core/**` directory was removed. Update imports to their new locations.
- `defaults.ts`, `InternalPatchOptions`, and related helpers were removed.
- Old tests referencing `CacheManager` or `processTailwindcss` no longer apply.

## 9. Checklist for upgrading projects

1. Update the dependency to the latest version of `tailwindcss-patch`.
2. Review custom imports from `tailwindcss-patch/core/*` and switch to the new module paths.
3. If you instantiate the patcher manually, adopt the new options object (or keep legacy options temporarily).
4. Refresh CLI usage in scripts (e.g. add `--output` or `--no-write` where appropriate).
5. For Tailwind v4 projects, configure `tailwindcss.v4.cssEntries` and `sources` so that `extract()` can discover candidates.
6. Run your extraction workflow and ensure the generated class list matches expectations.

For any regressions or gaps discovered during migration, please open an issue with reproduction details so we can iterate quickly.

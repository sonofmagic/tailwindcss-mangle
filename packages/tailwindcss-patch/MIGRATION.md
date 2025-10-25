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
  overwrite: true,
  cache: {
    enabled: true,
    dir: '.tw-patch/cache',
    strategy: 'merge',
  },
  output: {
    file: '.tw-patch/tw-class-list.json',
    format: 'json',
    removeUniversalSelector: true,
  },
  features: {
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: { units: ['rpx'] },
  },
  tailwind: {
    version: 4,
    v4: {
      base: './src',
      cssEntries: ['dist/tailwind.css'],
    },
  },
})
```

Both shapes are accepted. When the constructor detects `patch`/`cache` keys it automatically converts them via `fromLegacyOptions()`. This allows step-by-step migrations.

## 3. CLI changes

- `tw-patch install` still applies the runtime patch, but logging and error handling were refreshed.
- `tw-patch extract` gained new flags (`--output`, `--format`, `--no-write`, `--css`).
- Commands resolve configuration from `tailwindcss-patch.config.ts` via `@tailwindcss-mangle/config`. Existing configuration files continue to work without changes.

## 4. Cache handling

`CacheManager` has been replaced by `CacheStore`:

```ts
const cache = new CacheStore(normalized.cache)
await cache.write(new Set(['text-lg']))
const values = await cache.read()
```

This ensures consistent async behaviour and reliable error recovery (invalid JSON files are removed automatically).

## 5. Exported helpers

- Runtime context access now lives in `runtime/context-registry.ts` (`loadRuntimeContexts`).
- Tailwind v4 candidate extraction moved to `extraction/candidate-extractor.ts`.
- Custom unit support is available from `patching/operations/extend-length-units.ts`.

Update imports accordingly when consuming these helpers directly.

## 6. Configuration advice

`defineConfig` from `tailwindcss-patch` (provided by `@tailwindcss-mangle/config`) still emits the legacy `patch` object. All new fields—`output.format`, extended `tailwindcss.v4` options, `applyPatches.extendLengthUnits` objects—are handled transparently. You may migrate gradually by adding the new keys into the existing `patch` block.

If you want the new structure inside application code, prefer creating the patcher manually and pass the modern object as demonstrated above.

## 7. Feature highlights

- Tailwind v4 is supported without monkey patching. Provide CSS entries and content sources to `tailwind.v4` and call `extract()`.
- Custom length units patching (`extendLengthUnits`) now supports Tailwind v3 and v4 with a single option object.
- Filters are composed with the `output.removeUniversalSelector` flag so `'*'` can be kept when desired.

## 8. Removal summary

- The entire `src/core/**` directory was removed. Update imports to their new locations.
- `defaults.ts`, `InternalPatchOptions`, and related helpers were removed.
- Old tests referencing `CacheManager` or `processTailwindcss` no longer apply.

## 9. Checklist for upgrading projects

1. Update the dependency to the latest version of `tailwindcss-patch`.
2. Review custom imports from `tailwindcss-patch/core/*` and switch to the new module paths.
3. If you instantiate the patcher manually, adopt the new options object (or keep legacy options temporarily).
4. Refresh CLI usage in scripts (e.g. add `--output` or `--no-write` where appropriate).
5. For Tailwind v4 projects, configure `tailwind.v4.cssEntries` and `sources` so that `extract()` can discover candidates.
6. Run your extraction workflow and ensure the generated class list matches expectations.

For any regressions or gaps discovered during migration, please open an issue with reproduction details so we can iterate quickly.

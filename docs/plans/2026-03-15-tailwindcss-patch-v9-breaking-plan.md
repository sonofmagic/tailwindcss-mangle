# `tailwindcss-patch` v9 Breaking Plan

## Goal

Ship a `v9` of `packages/tailwindcss-patch` that preserves Tailwind CSS `v2` / `v3` / `v4` support while removing historical API baggage, reducing cold-start overhead caused by shared branching, and making future performance work structurally cheaper.

This plan is intentionally opinionated:

- Keep feature coverage for `v2` / `v3` / `v4`
- Break legacy configuration compatibility
- Require explicit version selection
- Split version-specific collection pipelines
- Tighten public method semantics
- Upgrade cache schema instead of carrying forward compatibility logic indefinitely

## Non-Goals

- Dropping Tailwind CSS `v2`
- Changing class-set correctness semantics
- Removing `getClassSetSync()` for `v2` / `v3`
- Replacing patch-file behavior with runtime monkey-patching
- Rewriting `weapp-tailwindcss` HMR flow at the same time

---

## Product Direction

`tailwindcss-patch` should remain a compatibility-oriented package, but the compatibility boundary must move from the public API surface into isolated internal collectors.

The package should expose a single modern API and a single CLI, while internally delegating to version-specialized implementations:

- `v2`: patch + runtime context + build pipeline
- `v3`: patch + runtime context + build pipeline
- `v4`: css entry discovery + source scanning + candidate validation pipeline

The current design centralizes those paths in one shared patcher and one shared option bridge. That keeps old integrations alive, but it imposes recurring costs:

- repeated normalize and legacy-option branching during startup
- broad cache schema that must explain multiple execution models
- cross-version conditionals in hot code paths
- tests that encode compatibility behavior rather than product behavior

`v9` should pay the migration cost once and simplify the package for the next cycle.

---

## Breaking Changes

### 1. Remove Legacy Constructor and Option Aliases

Delete support for:

- `LegacyTailwindcssPatcherOptions`
- `patch: { ... }` top-level wrapper
- top-level aliases:
  - `cwd`
  - `tailwind`
  - `features`
  - `output`
  - `overwrite`
- deprecated conversion from `registry.patch`
- legacy config aliases such as:
  - `tailwind.package`
  - `tailwind.legacy`
  - `tailwind.classic`
  - `tailwind.next`
  - `output.stripUniversalSelector`

Only the modern shape remains:

```ts
new TailwindcssPatcher({
  projectRoot,
  tailwindcss: {
    version: 2 | 3 | 4,
    packageName,
    resolve,
    config,
    cwd,
    v2,
    v3,
    v4,
  },
  apply: {
    overwrite,
    exposeContext,
    extendLengthUnits,
  },
  cache: {
    enabled,
    dir,
    file,
    strategy,
    driver,
  },
  extract: {
    write,
    file,
    format,
    pretty,
    removeUniversalSelector,
  },
  filter,
})
```

Why:

- removes initialization overhead in `options/legacy.ts` and `options/normalize.ts`
- simplifies type signatures in `api/tailwindcss-patcher.ts`
- shrinks test surface from “API compatibility” to actual behavior

### 2. Require `tailwindcss.version`

`tailwindcss.version` becomes mandatory. Runtime version guessing from installed package metadata is no longer part of the public contract.

Allowed values:

- `2`
- `3`
- `4`

Why:

- avoids ambiguous fallback behavior in mixed monorepo environments
- avoids runtime version coercion work
- makes `v2` preservation explicit instead of accidental

Rule:

- installed package version is still validated against the hint
- mismatches produce a clear error

### 3. Tighten Public Method Semantics

Public methods in `v9`:

- `patch()`
- `collect()`
- `getClassSet()`
- `getClassSetSync()`
- `extract()`
- `clearCache()`
- `getPatchStatus()`

Method semantics:

- `patch()` only applies file patches
- `collect()` only computes and returns the class set
- `getClassSet()` becomes a compatibility alias for `collect()`
- `extract()` performs `collect()` and serialization/output
- `getClassSetSync()` remains supported only for `v2` / `v3`

No method should imply hidden “do whatever is needed” behavior beyond its narrow contract.

Why:

- makes future lazy/prewarm/daemon optimizations legal
- clarifies where cold-start cost actually belongs
- makes down-stream call sites easier to reason about

### 4. Upgrade Cache Schema and Drop Legacy Read Compatibility

Introduce cache schema `v3` and stop reading old legacy schema variants.

Behavior:

- old cache files are treated as miss
- no legacy merge path
- no compatibility metadata for pre-v9 cache layouts

Why:

- removes compatibility branches from `cache/store.ts`
- simplifies on-disk invariants
- improves cache isolation guarantees

This is an intentional breaking change for persisted cache files, not for runtime API behavior.

---

## Internal Architecture

## Public Facade

Keep a single exported class:

- `TailwindcssPatcher`

Responsibilities:

- validate modern config
- resolve package metadata
- dispatch to a version-specific collector
- own cache store and extract serialization facade

The public class should stop containing version-specific branch-heavy implementation details.

## Version-Specific Collectors

Introduce internal collectors:

- `src/runtime/v2/runtime-collector.ts`
- `src/runtime/v3/runtime-collector.ts`
- `src/runtime/v4/candidate-collector.ts`

Shared interfaces:

```ts
interface ClassCollector {
  patch(): Promise<void>
  collect(): Promise<Set<string>>
  collectSync?(): Set<string> | undefined
  getPatchStatus(): Promise<PatchStatusReport>
}
```

Collector responsibilities:

- `v2`
  - patch export-context and length units
  - load runtime contexts
  - run Tailwind build when needed
- `v3`
  - patch export-context and length units
  - clear shared runtime state before build
  - load runtime contexts
  - run Tailwind build when needed
- `v4`
  - no runtime context loading
  - normalize `cssEntries` and `sources`
  - build candidate extraction and validation cache

## Suggested File Moves

- `src/api/tailwindcss-patcher.ts`
  - keep public class only
- `src/runtime/v2/*`
  - build
  - context loading
  - patch target snapshot
- `src/runtime/v3/*`
  - build
  - shared state cleanup
  - context loading
  - patch target snapshot
- `src/runtime/v4/*`
  - css entry discovery
  - sources fingerprint
  - candidate extractor cache
- `src/cache/*`
  - schema `v3`
  - versioned context descriptors

---

## Cache and Fingerprint Redesign

## Cache Storage Shape

Proposed top-level shape:

```json
{
  "schemaVersion": 3,
  "contexts": {
    "<cache-scope-key>": {
      "collector": "v2-runtime | v3-runtime | v4-candidate",
      "fingerprint": "<hash>",
      "values": ["..."]
    }
  }
}
```

`cache-scope-key` should encode isolation boundaries:

- normalized `projectRoot`
- Tailwind package root
- Tailwind package version
- collector type

## Fingerprint Inputs

### `v2` / `v3`

Include:

- normalized Tailwind config content hash
- relevant content file snapshots
- `apply.exposeContext`
- `apply.extendLengthUnits`
- runtime-collector-specific options

Exclude:

- extract output file path
- `pretty`
- `format`
- `removeUniversalSelector`
- patch target file mtimes once patch status is already stable

### `v4`

Include:

- normalized Tailwind config content hash
- normalized `cssEntries`
- normalized `sources`
- source snapshots relevant to class extraction
- candidate-validator-relevant options

Exclude:

- patch-only state
- serialization options

## Cache Rules

- empty class sets must still not be persisted as successful results
- repeated writes with identical class sets should continue to be skipped
- `clearCache()` should delete only entries for the current scope key unless explicitly widened later

---

## Config and CLI Migration

## Config Loading

`config/workspace.ts` should stop converting `registry.patch` or legacy patch blocks. It should only consume the unified modern registry shape.

If the workspace config still uses legacy keys, fail with a migration error that points to the modern shape.

## CLI

CLI behavior should stay functionally similar, but the generated config and docs must only emit modern keys.

Migration command support:

- keep migration commands that rewrite config files where they already exist
- remove any runtime fallback that silently accepts old keys after `v9`

---

## `weapp-tailwindcss` Migration Plan

`weapp-tailwindcss` already amortizes hot-path work through:

- `patchPromise` reuse
- runtime class-set caching
- config signature reuse
- incremental refresh avoidance

That means `v9` migration there should focus on option construction, not runtime architecture.

Expected migration points:

- patcher option assembly in `packages/weapp-tailwindcss/src/tailwindcss/patcher.ts`
- any config normalization that still writes deprecated keys
- tests that assume version auto-detection

Required adaptations:

1. Always pass explicit `tailwindcss.version`
2. Emit only `projectRoot`, `tailwindcss`, `apply`, `extract`, `cache`
3. Continue using `getClassSet()` / `extract()` exactly as before
4. Keep HMR tests that cover:
   - repeated patch
   - repeated getClassSet
   - config refresh
   - cssEntries refresh
   - add/remove content classes in `v3`

No change is required to the `weapp-tailwindcss` HMR strategy itself.

---

## Implementation Plan

### PR1: Remove Legacy API and Require Explicit Version

Changes:

- delete `LegacyTailwindcssPatcherOptions`
- delete `fromLegacyOptions`
- simplify `normalize.ts` to modern keys only
- require `tailwindcss.version`
- update docs, examples, CLI config generation

Validation:

- unit tests for constructor validation
- ensure deprecation-warning tests are replaced by migration-error tests
- `pnpm --filter tailwindcss-patch test`

Rollback:

- restore `legacy.ts` bridge and constructor union type only

### PR2: Split Collectors by Tailwind Version

Changes:

- introduce versioned collectors
- move `v2` / `v3` runtime build logic out of public patcher
- isolate `v4` candidate path
- keep public API unchanged after PR1 break

Validation:

- existing `v2` / `v3` / `v4` class-set tests
- HMR-style `v3` regression for removed classes
- targeted benchmark comparison

Rollback:

- collapse dispatch layer back into old public patcher while preserving PR1 API cleanup

### PR3: Upgrade Cache Schema to `v3`

Changes:

- remove legacy cache read compatibility
- install scope-key-based storage
- split fingerprint builders per collector type

Validation:

- cache hit / miss tests
- config changed / cssEntries changed / package version changed
- empty class set behavior
- clearCache behavior

Rollback:

- restore old cache parser only; keep scope-key abstraction

### PR4: Add `collect()` and Narrow Method Semantics

Changes:

- add `collect()`
- make `getClassSet()` a compatibility alias
- ensure `patch()` never performs hidden collect work
- update docs and tests

Validation:

- benchmark `patch only`, `collect only`, `extract only`
- repeated patch / repeated collect
- CLI extract behavior

Rollback:

- keep `collect()` but re-expand `getClassSet()` implementation if downstream behavior unexpectedly depends on it

---

## Testing Plan

## Unit Tests

Must cover:

- constructor rejects missing `tailwindcss.version`
- legacy option shapes fail with migration guidance
- repeated `patch()` no-op behavior
- repeated `collect()` cache hit behavior
- `v2` / `v3` `getClassSetSync()`
- `v4` `getClassSetSync()` throws
- `v3` add/remove content class refresh regression
- cache miss on:
  - config changed
  - cssEntries changed
  - package version changed
- empty class set is not cached
- `clearCache()` re-collects correctly

## Integration Tests

Keep these package-level integration fixtures:

- `v2` project
- `v3` project
- `v4` project
- multi-project / multi-`basedir` / multi-`cssEntries`

## Downstream Validation

Required before release:

- `packages/weapp-tailwindcss` targeted HMR and refresh suites
- local link or tarball test against real `weapp-tailwindcss`

---

## Benchmark Plan

`v9` should keep benchmark coverage as a release gate.

Minimum matrix:

- `v2 patch only`
- `v2 getClassSet only`
- `v2 extract only`
- `v3 patch only`
- `v3 getClassSet only`
- `v3 extract only`
- `v4 patch only`
- `v4 getClassSet only`
- `v4 extract only`
- cold first run
- warm repeated run
- repeated patch
- repeated collect

Release expectation:

- no regression in `patch only`
- no regression in `v4 getClassSet only`
- `v3` correctness fix for removed classes remains intact

---

## Risks

### Risk: Ecosystem Still Uses Legacy Config

Impact:

- immediate constructor/config load failures after upgrade

Mitigation:

- document migration clearly
- keep config migration command available
- provide explicit error messages with one-line before/after examples

### Risk: `weapp-tailwindcss` Assumes Version Guessing

Impact:

- runtime init failures in downstream integration

Mitigation:

- migrate `weapp-tailwindcss` in the same release train or before publishing `v9`

### Risk: Cache Upgrade Causes Perceived Regression on First Run

Impact:

- one-time cache miss after upgrade

Mitigation:

- document cache reset as expected behavior
- avoid mixing schema-upgrade work with unrelated performance claims

### Risk: `v2` Support Becomes a Maintenance Drag Again

Impact:

- future collector changes may start leaking `v2` concerns back into shared code

Mitigation:

- treat `v2` as a dedicated collector with strict test and directory boundaries

---

## Success Criteria

`v9` is successful if:

1. `tailwindcss-patch` exposes one modern config shape only.
2. `v2` / `v3` / `v4` support remains intact.
3. Version-specific logic is isolated behind internal collectors.
4. Cache schema and fingerprint rules are simpler and easier to reason about.
5. `weapp-tailwindcss` HMR and refresh tests pass unchanged after migration.
6. Cold-start benchmark does not regress on the already optimized `v8.x` baseline.

---

## Recommended Release Notes Summary

For the eventual `v9` changelog:

- Removed deprecated `tailwindcss-patch` constructor and config aliases
- `tailwindcss.version` is now required
- Added internal version-specific collection pipelines for Tailwind CSS `v2` / `v3` / `v4`
- Upgraded class-set cache schema; existing cache files rebuild automatically
- Added `collect()` and clarified method responsibilities
- Tailwind CSS `v2` support remains available

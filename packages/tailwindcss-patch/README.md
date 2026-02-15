# tailwindcss-patch

Modern tooling to patch Tailwind CSS, capture runtime contexts, and materialise every class that Tailwind can generate. The package now ships with a redesigned architecture focused on clarity, predictable configuration, and first-class Tailwind v4 support.

- Export runtime contexts for Tailwind v2/v3 without editing source files manually.
- Traverse Tailwind v4 projects by scanning CSS outputs and content sources.
- Write class inventories to disk or keep them in memory for tooling integrations.
- Control caching, filtering, and custom unit extensions from a single, typed entrypoint.

## Installation

```bash
pnpm add -D tailwindcss-patch
pnpm dlx tw-patch install
```

Keep the patch applied after installs by adding a `prepare` hook:

```json
{
  "scripts": {
    "prepare": "tw-patch install"
  }
}
```

## CLI Usage

Run the CLI through `tw-patch` (or `tailwindcss-patch`) from your project root.

```bash
# Apply runtime patches to the local Tailwind installation
pnpm dlx tw-patch install

# Extract all classes into the configured output file
pnpm dlx tw-patch extract

# Capture every token (candidate) with file/position metadata
pnpm dlx tw-patch tokens --format lines

# Check which patches are applied
pnpm dlx tw-patch status --json

# Migrate deprecated config fields to modern keys
pnpm dlx tw-patch migrate --dry-run
```

### Embed into another CLI

Reuse the same commands inside your own `cac` program:

```ts
import cac from 'cac'
import { mountTailwindcssPatchCommands } from 'tailwindcss-patch'

const cli = cac('my-tool')
mountTailwindcssPatchCommands(cli, {
  commandPrefix: 'tw:', // optional
  commands: ['install', 'tokens'], // mount a subset if needed (defaults to all)
  commandOptions: {
    install: { name: 'patch-install', aliases: ['tw-install'] }, // override names/aliases
  },
})
cli.help()
cli.parse()
```

#### Custom command hooks

Hosts can override per-command lifecycles by supplying `commandHandlers`. Each handler receives a context object (with the resolved `cwd`, parsed `args`, memoized `loadConfig`/`createPatcher` helpers, and the shared `logger`) plus a `next()` callback that runs the built-in action.

```ts
mountTailwindcssPatchCommands(cli, {
  commandHandlers: {
    install: async (ctx) => {
      const patcher = await ctx.createPatcher()
      await clearTailwindcssPatcherCache(ctx.cwd)
      await patcher.patch()
      await saveCliPatchTargetRecord({ cwd: ctx.cwd })
    },
    extract: async (ctx, next) => {
      const result = await next() // run the default extract implementation
      ctx.logger.success(`[host] wrote ${result.classList.length} classes`)
      return result
    },
  },
  commandOptions: {
    extract: {
      description: 'Localised extract command',
      appendDefaultOptions: false,
      optionDefs: [
        { flags: '--entry <file>', description: 'Tailwind CSS entry file' },
        { flags: '--preview', description: 'Print a preview instead of writing' },
      ],
    },
  },
})
```

Skip `next()` to fully replace a command (e.g. custom `init` or cache clearing before `install`). Calling `next()` returns the default result—`ExtractResult`, `TailwindTokenReport`, etc.—so hosts can log metadata or feed it into their own telemetry without re-implementing the commands.

### Extract options

| Flag                     | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `--cwd <dir>`            | Use a different working directory when loading configuration.    |
| `--output <file>`        | Override the target file for the generated class list.           |
| `--format <json\|lines>` | Switch between JSON output (default) and newline-delimited text. |
| `--css <file>`           | Provide a CSS entry file when working with Tailwind v4 projects. |
| `--no-write`             | Skip writing to disk and only return the collected classes.      |

The CLI loads `tailwindcss-patch.config.ts` via `@tailwindcss-mangle/config`. Legacy configs continue to work; see the [migration guide](./MIGRATION.md) for hints on the new fields.

### Migrate options

| Flag             | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `--cwd <dir>`    | Working directory used to locate config files.                               |
| `--config <file>`| Migrate only one specific config file path.                                  |
| `--workspace`    | Recursively scan the workspace for supported config filenames.               |
| `--max-depth <n>`| Maximum recursion depth for `--workspace` mode (default: `6`).               |
| `--backup-dir <dir>` | Store pre-migration file backups in this directory.                     |
| `--check`        | Check mode for CI. Exits with an error if files still need migration.        |
| `--json`         | Print the migration report as JSON.                                           |
| `--dry-run`      | Preview planned changes without writing files.                               |

`tw-patch migrate` scans `tailwindcss-patch.config.*` and `tailwindcss-mangle.config.*` in the target directory. With `--workspace`, it recursively scans sub-projects (excluding folders like `node_modules`, `.git`, and `dist`). It rewrites deprecated keys (for example `registry.output` -> `registry.extract`, `registry.tailwind` -> `registry.tailwindcss`) and prints a per-file change summary.

When writing files, migration uses a transactional strategy by default: if a later file write fails, already written migration files are rolled back to avoid partial updates. Use `--backup-dir` if you want explicit backup snapshots for audit/manual recovery.

### Token report options

| Flag                                   | Description                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `--cwd <dir>`                          | Use a different working directory when loading configuration.                             |
| `--output <file>`                      | Override the token report target file (defaults to `.tw-patch/tw-token-report.json`).     |
| `--format <json\|lines\|grouped-json>` | Choose between a JSON payload (default), newline summaries, or JSON grouped by file path. |
| `--group-key <relative\|absolute>`     | Control grouped-json keys (defaults to relative paths).                                   |
| `--no-write`                           | Skip writing to disk and only print a preview.                                            |

## Programmatic API

```ts
import { TailwindcssPatcher } from 'tailwindcss-patch'

const patcher = new TailwindcssPatcher({
  projectRoot: process.cwd(),
  cache: {
    enabled: true,
    dir: '.tw-patch/cache',
    strategy: 'merge',
    driver: 'file',
  },
  extract: {
    write: true,
    file: '.tw-patch/tw-class-list.json',
    format: 'json',
  },
  apply: {
    overwrite: true,
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: {
      units: ['rpx'],
    },
  },
  tailwindcss: {
    version: 4,
    v4: {
      base: './src',
      cssEntries: ['dist/tailwind.css'],
    },
  },
})

await patcher.patch()
const { classList, filename } = await patcher.extract()
const tokenReport = await patcher.collectContentTokens()
console.log(tokenReport.entries[0]) // { rawCandidate, file, line, column, ... }
const groupedTokens = await patcher.collectContentTokensByFile()
console.log(groupedTokens['src/button.tsx'][0].rawCandidate)
// Preserve absolute file paths:
// await patcher.collectContentTokensByFile({ key: 'absolute', stripAbsolutePaths: false })
const patchStatus = await patcher.getPatchStatus()
console.log(patchStatus.entries)
```

The constructor accepts either the new object shown above or historical shapes. Conversions happen internally so existing configs remain backwards compatible.

Deprecated fields kept temporarily (to be removed in the next major): `cwd`, `overwrite`, `tailwind`, `features`, `output`.

Migration mapping:
- `cwd` -> `projectRoot`
- `overwrite` -> `apply.overwrite`
- `tailwind` -> `tailwindcss`
- `features` -> `apply`
- `output` -> `extract`

When deprecated fields are detected at runtime, `normalizeOptions` logs a one-time warning to help migration.

Use cache.driver to switch between the default file-backed cache, an in-memory cache (memory), or a no-op cache (noop) when filesystem permissions are restricted.

### Cache governance (schema v2)

`tailwindcss-patch` now isolates cache entries by **context fingerprint** to prevent cross-project pollution in monorepos.

- Cache file format uses an indexed schema (`schemaVersion: 2`) with per-context entries.
- A cache hit requires both fingerprint and metadata consistency.
- Legacy array caches are read safely and treated as misses, then lazily rebuilt on write.
- Writes are protected by lock file + atomic temp-file rename to avoid concurrent corruption.

Fingerprint components:

- realpath-normalized `process.cwd()`
- realpath-normalized project root / cache cwd
- Tailwind config absolute path (if found) + config mtime
- Tailwind package root + version
- `tailwindcss-patch` package version
- deterministic hash of key patch options (stable key ordering)

The fingerprint is computed once in the patcher constructor and reused during all cache operations.

### Clearing cache explicitly

```ts
// default: clear current context only
const current = await patcher.clearCache()
// => { scope: 'current', filesRemoved, entriesRemoved, contextsRemoved }

// clear all contexts from the cache index
const all = await patcher.clearCache({ scope: 'all' })
```

Debug observability:

- cache hit logs include fingerprint + schema
- cache miss logs include miss reason and mismatch details (config/version/path/options)

### Helper utilities

- `normalizeOptions` – normalise raw user input to the runtime shape.
- `CacheStore` – read/write class caches (file, memory, or noop drivers) respecting merge or overwrite semantics.
- `extractProjectCandidatesWithPositions` – gather Tailwind tokens for every configured source file with location metadata.
- `groupTokensByFile` – convert a token report into a `{ [filePath]: TailwindTokenLocation[] }` map.
- `extractValidCandidates` – scan Tailwind v4 CSS/content sources with the Tailwind Oxide scanner.
- `runTailwindBuild` – run the Tailwind PostCSS plugin for v2/v3 projects to prime runtime contexts.

All helpers are exported from the package root for direct consumption in custom tooling.

## Configuration Example

```ts
// tailwindcss-patch.config.ts
import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    projectRoot: '.',
    extract: {
      file: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      format: 'json',
    },
    tailwindcss: {
      version: 4,
      v4: {
        cssEntries: ['dist/tailwind.css'],
        sources: [{ base: 'src', pattern: '**/*.{html,tsx}', negated: false }],
      },
    },
    apply: {
      overwrite: true,
      exposeContext: true,
      extendLengthUnits: {
        units: ['rpx'],
      },
    },
  },
})
```

`defineConfig` supports both modern `registry` fields (`projectRoot`, `tailwindcss`, `apply`, `extract`) and historical keys. The patcher normalizer handles both and always prefers modern fields when both are present.

## Migration

Breaking changes, module moves, and upgrade paths are documented in [MIGRATION.md](./MIGRATION.md). Review it when updating from tailwindcss-patch v7.x or earlier.

## License

MIT © ice breaker

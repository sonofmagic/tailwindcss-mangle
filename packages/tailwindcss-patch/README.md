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
```

### Extract options

| Flag                     | Description                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| `--cwd <dir>`            | Use a different working directory when loading configuration.    |
| `--output <file>`        | Override the target file for the generated class list.           |
| `--format <json\|lines>` | Switch between JSON output (default) and newline-delimited text. |
| `--css <file>`           | Provide a CSS entry file when working with Tailwind v4 projects. |
| `--no-write`             | Skip writing to disk and only return the collected classes.      |

The CLI loads `tailwindcss-patch.config.ts` via `@tailwindcss-mangle/config`. Legacy configs continue to work; see the [migration guide](./MIGRATION.md) for hints on the new fields.

## Programmatic API

```ts
import { TailwindcssPatcher } from 'tailwindcss-patch'

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
  },
  features: {
    exposeContext: { refProperty: 'runtimeContexts' },
    extendLengthUnits: {
      units: ['rpx'],
    },
  },
  tailwind: {
    version: 4,
    v4: {
      base: './src',
      cssEntries: ['dist/tailwind.css'],
    },
  },
})

await patcher.patch()
const { classList, filename } = await patcher.extract()
```

The constructor accepts either the new object shown above or the historical `patch`/`cache` shape. Conversions happen internally so existing configs remain backwards compatible.

### Helper utilities

- `normalizeOptions` – normalise raw user input to the runtime shape.
- `CacheStore` – read/write class caches respecting merge or overwrite semantics.
- `extractValidCandidates` – scan Tailwind v4 CSS/content sources with the Tailwind Oxide scanner.
- `runTailwindBuild` – run the Tailwind PostCSS plugin for v2/v3 projects to prime runtime contexts.

All helpers are exported from the package root for direct consumption in custom tooling.

## Configuration Example

```ts
// tailwindcss-patch.config.ts
import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  patch: {
    output: {
      filename: '.tw-patch/tw-class-list.json',
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
    applyPatches: {
      exportContext: true,
      extendLengthUnits: {
        units: ['rpx'],
      },
    },
  },
})
```

Even though `defineConfig` still exposes the historical shape, every new option is supported and will be normalised automatically.

## Migration

Breaking changes, module moves, and upgrade paths are documented in [MIGRATION.md](./MIGRATION.md). Review it when updating from tailwindcss-patch v7.x or earlier.

## License

MIT © ice breaker

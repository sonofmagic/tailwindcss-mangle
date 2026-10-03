# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tailwindcss-mangle** is a monorepo utility for obfuscating Tailwind CSS class names to reduce bundle sizes. It converts readable class names (e.g., `bg-red-500`) to shorter, obfuscated versions (e.g., `a`) while maintaining functionality.

## Development Commands

```bash
# Build all packages
pnpm build

# Run all packages in watch mode (development)
pnpm dev

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:dev

# Lint
pnpm lint

# Record a publishable change and inspect the release plan
pnpm change
pnpm release:plan

# Validate packages, documentation, and all app integration suites
pnpm release:verify

# Package-specific development (example: core package)
cd packages/core && pnpm dev      # Watch mode build
cd packages/core && pnpm test     # Run tests for this package only
```

## Architecture

### Monorepo Structure

This is a **pnpm workspace** monorepo whose shared tooling and releases are managed by **repoctl**. See `AGENTS.md` for the quality gate and `repoctl.config.ts` for tooling policy. Key packages:

| Package                       | Purpose                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `@tailwindcss-mangle/core`    | Main transformation engine (CSS, HTML, JS processing)                    |
| `@tailwindcss-mangle/shared`  | Shared utilities and ClassGenerator implementation                       |
| `@tailwindcss-mangle/config`  | Configuration management using c12                                       |
| `@tailwindcss-mangle/engine`  | Candidate extraction and style generation, including the Node 18 runtime |
| `tailwindcss-patch`           | Patches Tailwind CSS runtime to expose contexts (CLI: `tw-patch`)        |
| `unplugin-tailwindcss-mangle` | Build plugin for Vite/Webpack/Rollup/ESbuild                             |

### Core Flow

1. **Patch Layer** (`tailwindcss-patch`) - Modifies Tailwind CSS internals to expose runtime contexts
2. **Context** (`@tailwindcss-mangle/core/src/ctx/index.ts`) - Central state management:
   - `replaceMap`: Maps original class names to mangled versions
   - `classSet`: All discovered Tailwind classes
   - `classGenerator`: Generates obfuscated names using configurable strategies
   - `initConfig()`: Loads config from file or options, builds class list
   - `dump()`: Writes mapping file on build completion
3. **Handlers** (`@tailwindcss-mangle/core/src/*/index.ts`):
   - `cssHandler` - PostCSS-based CSS transformation
   - `jsHandler` - Babel AST-based JavaScript/TypeScript transformation
   - `htmlHandler` - HTML parser-based transformation
4. **Plugin Factory** (`unplugin-tailwindcss-mangle/src/core/factory.ts`) - Creates three plugin phases:
   - `:pre` - Initialize context and filters
   - (no suffix) - Transform files during build
   - `:post` - Process final assets and dump mapping

### Key Integration Points

- **Vite**: Uses `transformInclude` filter + `transform` hook
- **Webpack**: Injects custom loader before `postcss-loader` + `processAssets` hook
- **Transform Extensions**: `.js`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.css`, `.html`

### Testing

- **Framework**: Vitest with project-based config discovery
- **Root Config**: `vitest.config.ts` - auto-discovers package configs via pnpm-workspace.yaml
- **Coverage**: `vitest run --coverage.enabled`
- **Package Tests**: Each package has its own `vitest.config.ts` and `test/` directory

### Build System

- **Bundler**: tsdown (ESM and declarations; the engine also emits CJS)
- **Orchestration**: Package builds run in workspace dependency order
- **Outputs**: `dist/` folder in each package
- **Entry Points**: Runtime workspace imports and published imports resolve to `dist/`

## Important Notes

- **Node version**: Development requires >=22.22.1; engine runtime compatibility remains >=18.20
- **Package manager**: pnpm only (enforced by preinstall hook)
- **Install lifecycle**: Root preparation installs Git hooks; app preparation runs `tw-patch` or Nuxt setup only when built dependencies are ready
- **Releases**: Native pnpm change intents, with repoctl managing Release PRs and publication. Use `pnpm release:plan` for read-only validation
- **Module system**: ES modules (`"type": "module"`)
- **Class filtering**: Uses `fast-sort` to process longer classes first (handles variants like `bg-red-500/50` before `bg-red-500`)

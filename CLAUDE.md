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

# Lint and fix
pnpm lint

# Build, test, version, and publish packages
pnpm publish-packages

# Package-specific development (example: core package)
cd packages/core && pnpm dev      # Watch mode build
cd packages/core && pnpm test     # Run tests for this package only
```

## Architecture

### Monorepo Structure

This is a **pnpm workspace** monorepo managed by **Turbo**. Key packages:

| Package | Purpose |
|---------|---------|
| `@tailwindcss-mangle/core` | Main transformation engine (CSS, HTML, JS processing) |
| `@tailwindcss-mangle/shared` | Shared utilities and ClassGenerator implementation |
| `@tailwindcss-mangle/config` | Configuration management using c12 |
| `tailwindcss-patch` | Patches Tailwind CSS runtime to expose contexts (CLI: `tw-patch`) |
| `unplugin-tailwindcss-mangle` | Build plugin for Vite/Webpack/Rollup/ESbuild |

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

- **Bundler**: tsup (TypeScript → ESM + CJS + .d.ts)
- **Orchestration**: Turbo (handles dependencies and caching)
- **Outputs**: `dist/` folder in each package
- **Entry Points**: Packages export from `src/` directly during dev, `dist/` when published

## Important Notes

- **Node version**: Requires >=18.0.0
- **Package manager**: pnpm only (enforced by preinstall hook)
- **Post-install**: Runs `tw-patch install` automatically
- **Module system**: ES modules (`"type": "module"`)
- **Class filtering**: Uses `fast-sort` to process longer classes first (handles variants like `bg-red-500/50` before `bg-red-500`)

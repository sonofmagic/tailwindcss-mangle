# Engine Benchmarks

This directory contains generated large-file benchmarks for `@tailwindcss-mangle/engine`.

## Commands

```bash
pnpm --filter @tailwindcss-mangle/engine bench
pnpm --filter @tailwindcss-mangle/engine bench:small
pnpm --filter @tailwindcss-mangle/engine bench:large
pnpm --filter @tailwindcss-mangle/engine bench:clean
```

The benchmark creates mixed framework fixtures under `bench/generated/large-project` and writes the latest markdown report to `bench/reports/latest.md`.

## Coverage

The generated dataset includes large `.html`, `.vue`, `.js`, `.ts`, `.jsx`, `.tsx`, `.wxml`, `.css`, `.svelte`, and `.astro` files. Each file contains repeated Tailwind utilities, arbitrary values, framework-specific class containers, CSS `@apply` usage, and non-class noise tokens.

The benchmark measures:

- `extractSourceCandidatesWithPositions` for each extension.
- `extractRawCandidates` over the generated filesystem project.
- `extractProjectCandidatesWithPositions` metadata scanning.
- `extractValidCandidates` with Tailwind v4 validation.
- `createTailwindV4Engine().generate` with filesystem scanning.

## Sizing

Use these environment variables to tune the generated project:

- `TWM_ENGINE_BENCH_SCALE=small|default|large`
- `TWM_ENGINE_BENCH_FILES_PER_EXTENSION=<number>`
- `TWM_ENGINE_BENCH_BLOCKS_PER_FILE=<number>`
- `TWM_ENGINE_BENCH_WARMUPS=<number>`
- `TWM_ENGINE_BENCH_ITERATIONS=<number>`

For more stable numbers, run Node with GC exposed:

```bash
pnpm --filter @tailwindcss-mangle/engine exec node --expose-gc --import tsx bench/performance.ts
```

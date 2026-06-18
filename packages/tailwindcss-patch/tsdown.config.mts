import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.bundle.ts',
    'cli': 'src/cli.ts',
    'commands/cli-runtime': 'src/commands/cli.ts',
  },
  shims: true,
  clean: true,
  format: ['cjs', 'esm'],
  dts: true,
  fixedExtension: false,
  deps: {
    skipNodeModulesBundle: true,
    neverBundle: ['tailwindcss'],
  },
})

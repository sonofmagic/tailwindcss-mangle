import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    'index': 'src/index.bundle.ts',
    'cli': 'src/cli.bundle.ts',
    'commands/cli-runtime': 'src/commands/cli.ts',
  },
  shims: true,
  clean: true,
  format: ['cjs', 'esm'], // , 'esm'
  dts: true,
  cjsInterop: true,
  splitting: true,
  noExternal: ['cac'],
  external: ['tailwindcss', '@tailwindcss/node', '@tailwindcss/oxide'],
})

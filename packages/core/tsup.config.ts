import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
  ], // , 'src/cli.ts'],
  shims: true,
  format: ['cjs', 'esm'],
  clean: true,
  dts: true,
  // cjsInterop: true,
  // splitting: true,
})

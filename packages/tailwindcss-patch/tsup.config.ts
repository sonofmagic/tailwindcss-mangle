import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  shims: true,
  clean: true,
  format: ['cjs', 'esm'], // , 'esm'
  dts: true,
  cjsInterop: true,
  splitting: true,
})

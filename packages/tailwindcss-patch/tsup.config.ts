import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  shims: true,
  sourcemap: false,
  clean: true,
  format: ['cjs'], //, 'esm'
  dts: true
})

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  sourcemap: false,
  clean: true,
  format: ['cjs', 'esm'],
  dts: true
})

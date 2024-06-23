import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vite.ts',
    'src/esbuild.ts',
    'src/nuxt.ts',
    'src/rollup.ts',
    'src/webpack.ts',
    'src/utils.ts',
  ], // , 'src/cli.ts'],
  shims: true,
  format: ['cjs', 'esm'],
  clean: true,
  dts: true,
  cjsInterop: true,
  splitting: true,
})

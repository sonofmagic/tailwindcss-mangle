import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vite.ts',
    'src/esbuild.ts',
    'src/nuxt.ts',
    'src/rollup.ts',
    'src/webpack.ts',
    'src/utils.ts',
    'src/loader.ts',
  ],
  shims: true,
  format: ['esm'],
  clean: true,
  dts: true,
  fixedExtension: false,
  define: {
    __DEV__: 'false',
  },
  deps: {
    skipNodeModulesBundle: true,
  },
})

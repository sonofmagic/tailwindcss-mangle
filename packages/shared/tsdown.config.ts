import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  shims: true,
  format: ['cjs', 'esm'],
  clean: true,
  dts: true,
  fixedExtension: false,
  deps: {
    skipNodeModulesBundle: true,
  },
})

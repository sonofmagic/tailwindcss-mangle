import path from 'pathe'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    'src/index.ts',
    'src/vite.ts',
    'src/esbuild.ts',
    'src/rollup.ts',
    'src/webpack.ts',
    'src/utils.ts',
    'src/core/loader.ts',
  ],
  rollup: {
    replace: {
      values: {
        __DEV__: false,
      },
    },
    inlineDependencies: true,
    emitCJS: true,
    cjsBridge: true,
    dts: {
      // https://github.com/unjs/unbuild/issues/135
      respectExternal: false,
    },
  },
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
  declaration: true,

})

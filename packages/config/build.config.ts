import path from 'node:path'
import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // entries: ['./src/index', './src/cli'],
  rollup: {
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

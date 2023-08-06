import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  // entries: ['./src/index', './src/cli'],
  rollup: {
    inlineDependencies: true,
    emitCJS: true,
    dts: {
      // https://github.com/unjs/unbuild/issues/135
      respectExternal: false
    }
  },
  declaration: true
})

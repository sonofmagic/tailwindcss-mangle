import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['./src/index', './src/cli'],
  rollup: {
    inlineDependencies: true,
    emitCJS: true,
    dts: {
      respectExternal: false
    }
  },
  declaration: true
})

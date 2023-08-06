import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  rollup: {
    inlineDependencies: true
  }
  // devDependencies: ['defu', '@parse5/tools']
})

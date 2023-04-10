import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'

const unplugin = createUnplugin((options: Options) => {
  const wholeModule: string[] = []
  const filterResource: string[] = []
  return {
    name: pluginName,
    // webpack's id filter is outside of loader logic,
    // an additional hook is needed for better perf on webpack
    transformInclude(id) {
      wholeModule.push(id)
      return /\.(?:html?|vue|[jt]sx?|(?:c|le|s[ac])ss)$/.test(id)
    },
    // just like rollup transform
    transform(code, id) {
      // if (/\.(?:html?|vue|[jt]sx?|(?:c|le|s[ac])ss)^/.test(id)) {
      //   filterResource.push(id)
      //   return code
      // }
      filterResource.push(id)
      return code
    },
    buildEnd() {
      console.log(wholeModule, filterResource)
    }
    // more hooks coming
  }
})
export default unplugin
// export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
// export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild
// export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
// export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild

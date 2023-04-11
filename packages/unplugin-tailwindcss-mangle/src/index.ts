import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'
import { getClassCacheSet } from 'tailwindcss-patch'
import { parse, serialize, parseFragment } from 'parse5'
import { traverse } from '@parse5/tools'
const unplugin = createUnplugin((options: Options, meta) => {
  const wholeModule: string[] = []
  const filterResource: string[] = []
  let classSet = new Set()
  return {
    name: pluginName,
    enforce: 'post',
    // vite: {},
    // rollup: {
    //   options: {
    //     order: 'post'
    //   }
    // },
    buildStart() {
      // this.emitFile({
      //   type: 'asset',
      //   fileName: 'tw_mangle_tmp.css',
      //   source: ''
      // })
    },
    // webpack's id filter is outside of loader logic,
    // an additional hook is needed for better perf on webpack
    transformInclude(id) {
      wholeModule.push(id)
      const set = getClassCacheSet()
      if (set.size) {
        classSet = set
      }
      return true
      // return /\.(?:html?|vue|[jt]sx?|(?:c|le|s[ac])ss)$/.test(id)
    },
    // writeBundle() {},
    // just like rollup transform
    transform(code, id) {
      console.log(classSet.size)
      if (/\.html?$/.test(id)) {
        // console.log('html', id)
        const fragment = parseFragment(code)
        traverse(fragment, {
          element(node, parent) {
            console.log(node)
          }
        })
        // serialize(fragment)
        filterResource.push(id)
        return code
      }
      if (/\.(?:vue|pug|svelte|[jt]sx?)$/.test(id)) {
        // console.log('js', id)
        const ast = this.parse(code)
        filterResource.push(id)
        return code
      }

      if (/\.((?:c|le|s[ac])ss|styl)$/.test(id)) {
        // const classSet = getClassCacheSet()
        // console.log(classSet)
        // console.log('css', id)
        const classSet = getClassCacheSet()
        console.log(classSet.size)
        filterResource.push(id)

        return code
      }
      return code
    },
    buildEnd() {
      const classSet = getClassCacheSet()
      console.log(classSet)
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

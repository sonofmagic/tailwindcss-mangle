import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'
import { getClassCacheSet } from 'tailwindcss-patch'
import { getGroupedEntries } from './utils'
import { OutputAsset, OutputChunk } from 'rollup'
import ClassGenerator from './classGenerator'
import { htmlHandler } from './html'
import { jsHandler } from './js'
import { cssHandler } from './css'
import type {} from 'webpack'
const unplugin = createUnplugin((options: Options | undefined = {}, meta) => {
  // const preserveClass = ['filter']
  const mangleClass = (className: string) => {
    // ignore className like 'filter','container'
    // it may be dangerous to mangle/rename all StringLiteral , so use /-/ test for only those with /-/ like:
    // bg-[#123456] w-1 etc...
    return /-/.test(className)
  }
  let classSet: Set<string>
  let cached: boolean
  const classGenerator = new ClassGenerator()
  function getCachedClassSet() {
    if (cached) {
      return classSet
    }
    const set = getClassCacheSet()
    set.forEach((c) => {
      if (!mangleClass(c)) {
        set.delete(c)
      }
    })
    // preserveClass.forEach((c) => {
    //   set.delete(c)
    // })
    classSet = set
    cached = true
    return classSet
  }
  return {
    name: pluginName,
    enforce: 'post',
    vite: {
      generateBundle: {
        handler(options, bundle, isWrite) {
          const runtimeSet = getCachedClassSet()
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (groupedEntries.html.length) {
            for (let i = 0; i < groupedEntries.html.length; i++) {
              const [, asset] = groupedEntries.html[i] as [string, OutputAsset]
              asset.source = htmlHandler(asset.source.toString(), {
                classGenerator,
                runtimeSet
              })
            }
          }
          if (groupedEntries.js.length) {
            for (let i = 0; i < groupedEntries.js.length; i++) {
              const [, chunk] = groupedEntries.js[i] as [string, OutputChunk]
              chunk.code = jsHandler(chunk.code, {
                runtimeSet,
                classGenerator
              }).code
            }
          }

          if (groupedEntries.css.length) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [, css] = groupedEntries.css[i] as [string, OutputAsset]
              css.source = cssHandler(css.source.toString(), {
                classGenerator,
                runtimeSet
              })
            }
          }
        }
      }
    },
    webpack(compiler) {}
  }
})
export default unplugin
export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild
// export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
// export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild

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

          if (Array.isArray(groupedEntries.html) && groupedEntries.html.length) {
            for (let i = 0; i < groupedEntries.html.length; i++) {
              const [, asset] = groupedEntries.html[i] as [string, OutputAsset]
              asset.source = htmlHandler(asset.source.toString(), {
                classGenerator,
                runtimeSet
              })
            }
          }
          if (Array.isArray(groupedEntries.js) && groupedEntries.js.length) {
            for (let i = 0; i < groupedEntries.js.length; i++) {
              const [, chunk] = groupedEntries.js[i] as [string, OutputChunk]
              chunk.code = jsHandler(chunk.code, {
                runtimeSet,
                classGenerator
              }).code
            }
          }

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length) {
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
    webpack(compiler) {
      const Compilation = compiler.webpack.Compilation
      const { ConcatSource } = compiler.webpack.sources
      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: pluginName,
            stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          },
          (assets) => {
            // const resolvePath = require.resolve('tailwindcss')
            // console.log(resolvePath)
            const runtimeSet = getCachedClassSet()
            const groupedEntries = getGroupedEntries(Object.entries(assets))
            if (Array.isArray(groupedEntries.html) && groupedEntries.html.length) {
              for (let i = 0; i < groupedEntries.html.length; i++) {
                const [file, asset] = groupedEntries.html[i]
                const html = htmlHandler(asset.source().toString(), {
                  classGenerator,
                  runtimeSet
                })
                const source = new ConcatSource(html)
                compilation.updateAsset(file, source)
              }
            }
            if (Array.isArray(groupedEntries.js) && groupedEntries.js.length) {
              for (let i = 0; i < groupedEntries.js.length; i++) {
                const [file, chunk] = groupedEntries.js[i]
                const code = jsHandler(chunk.source().toString(), {
                  runtimeSet,
                  classGenerator
                }).code
                const source = new ConcatSource(code)
                compilation.updateAsset(file, source)
              }
            }

            if (Array.isArray(groupedEntries.css) && groupedEntries.css.length) {
              for (let i = 0; i < groupedEntries.css.length; i++) {
                const [file, css] = groupedEntries.css[i]
                const newCss = cssHandler(css.source().toString(), {
                  classGenerator,
                  runtimeSet
                })
                const source = new ConcatSource(newCss)
                compilation.updateAsset(file, source)
              }
            }
          }
        )
      })
    }
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

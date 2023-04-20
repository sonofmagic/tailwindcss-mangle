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
import type { sources } from 'webpack'
import path from 'path'

// const cachedHtmlSource = new Map<string, sources.Source | OutputAsset>()
// const cachedJsSource = new Map<string, sources.Source | OutputChunk>()
// const cachedCssSource = new Map<string, sources.Source | OutputAsset>()

const outputCachedMap = new Map<
  string,
  {
    html: Map<string, sources.Source | OutputAsset>
    js: Map<string, sources.Source | OutputChunk>
    css: Map<string, sources.Source | OutputAsset>
  }
>()

export const unplugin = createUnplugin((options: Options | undefined = {}, meta) => {
  const isMangleClass = (className: string) => {
    // ignore className like 'filter','container'
    // it may be dangerous to mangle/rename all StringLiteral , so use /-/ test for only those with /-/ like:
    // bg-[#123456] w-1 etc...
    return /[-:]/.test(className)
  }
  let classSet: Set<string>
  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)
  function getCachedClassSet() {
    const set = getClassCacheSet()
    set.forEach((c) => {
      if (!isMangleClass(c)) {
        set.delete(c)
      }
    })

    classSet = set

    return classSet
  }

  return {
    name: pluginName,
    enforce: 'post',
    vite: {
      generateBundle: {
        handler(options, bundle, isWrite) {
          const runtimeSet = getCachedClassSet()
          if (!runtimeSet.size) {
            return
          }
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
      function getEmitAssetPath(outputPath: string, file: string) {
        return path.relative(compiler.context, path.resolve(outputPath, file))
      }
      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: pluginName,
            stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          },
          (assets) => {
            // nextjs webpack build multiple times
            // server / manifest / client
            // const resolvePath = require.resolve('tailwindcss')
            // console.log(resolvePath)
            // console.log(compiler.outputPath)
            const runtimeSet = getCachedClassSet()
            const groupedEntries = getGroupedEntries(Object.entries(assets))

            if (!runtimeSet.size) {
              const css = new Map()
              const html = new Map()
              const js = new Map()
              groupedEntries.css.forEach(([file, source]) => {
                css.set(file, source)
              })
              groupedEntries.html.forEach(([file, source]) => {
                html.set(file, source)
              })
              groupedEntries.js.forEach(([file, source]) => {
                js.set(file, source)
              })
              if (js.size || css.size || html.size) {
                outputCachedMap.set(compiler.outputPath, {
                  css,
                  html,
                  js
                })
              }

              return
            }

            if (groupedEntries.html.length) {
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
            outputCachedMap.forEach(({ html }, key) => {
              if (html.size) {
                html.forEach((asset, file) => {
                  const html = htmlHandler((asset as sources.Source).source().toString(), {
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(html)
                  compilation.emitAsset(getEmitAssetPath(key, file), source)
                })
                html.clear()
              }
            })

            if (groupedEntries.js.length) {
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

            outputCachedMap.forEach(({ js }, key) => {
              if (js.size) {
                js.forEach((chunk, file) => {
                  const code = jsHandler((chunk as sources.Source).source().toString(), {
                    runtimeSet,
                    classGenerator
                  }).code
                  const source = new ConcatSource(code)
                  compilation.emitAsset(getEmitAssetPath(key, file), source)
                })
                js.clear()
              }
            })

            if (groupedEntries.css.length) {
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

            outputCachedMap.forEach(({ css }, key) => {
              if (css.size) {
                css.forEach((style, file) => {
                  const newCss = cssHandler((style as sources.Source).source().toString(), {
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(newCss)
                  compilation.emitAsset(getEmitAssetPath(key, file), source)
                })
                css.clear()
              }
            })
          }
        )
      })
    }
  }
})

export const vitePlugin = unplugin.vite
export const webpackPlugin = unplugin.webpack
// export default unplugin
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

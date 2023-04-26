import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'
import { getGroupedEntries } from './utils'
import type { OutputAsset, OutputChunk } from 'rollup'
import { htmlHandler } from './html'
import { jsHandler } from './js'
import { cssHandler } from './css'
import type { sources } from 'webpack'
import path from 'path'
import fs from 'fs'
import { getOptions } from './options'

// cache map
const outputCachedMap = new Map<
  string,
  {
    html: Map<string, sources.Source | OutputAsset>
    js: Map<string, sources.Source | OutputChunk>
    css: Map<string, sources.Source | OutputAsset>
  }
>()

export const unplugin = createUnplugin((options: Options | undefined = {}, meta) => {
  const { classGenerator, getCachedClassSet, isInclude } = getOptions(options)

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
              const [file, asset] = groupedEntries.html[i] as [string, OutputAsset]
              if (isInclude(file)) {
                asset.source = htmlHandler(asset.source.toString(), {
                  classGenerator,
                  runtimeSet
                })
              }
            }
          }
          if (Array.isArray(groupedEntries.js) && groupedEntries.js.length) {
            for (let i = 0; i < groupedEntries.js.length; i++) {
              const [file, chunk] = groupedEntries.js[i] as [string, OutputChunk]
              if (isInclude(file)) {
                chunk.code = jsHandler(chunk.code, {
                  runtimeSet,
                  classGenerator
                }).code
              }
            }
          }

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [file, css] = groupedEntries.css[i] as [string, OutputAsset]
              if (isInclude(file)) {
                css.source = cssHandler(css.source.toString(), {
                  classGenerator,
                  runtimeSet
                })
              }
            }
          }
        }
      }
    },
    webpack(compiler) {
      const Compilation = compiler.webpack.Compilation
      const { ConcatSource } = compiler.webpack.sources
      function getAssetPath(outputPath: string, file: string, abs: boolean = true) {
        const fn = abs ? path.resolve : path.relative
        return fn(compiler.context, path.resolve(outputPath, file))
      }

      function overwriteServerSideAsset(outputPath: string, file: string, data: string) {
        const abs = getAssetPath(outputPath, file)
        const rel = getAssetPath(outputPath, file, false)
        try {
          fs.writeFileSync(abs, data, 'utf-8')
          console.log('[tailwindcss-mangle]: ' + rel + ' overwrited successfully')
        } catch (error) {
          console.log('[tailwindcss-mangle]: ' + rel + ' overwrited fail!')
          console.log(error)
        }
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
            // cache result
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

            // fs.writeFileSync('./tw-class-set.json', JSON.stringify(Array.from(runtimeSet)), 'utf-8')

            if (groupedEntries.html.length) {
              for (let i = 0; i < groupedEntries.html.length; i++) {
                const [file, asset] = groupedEntries.html[i]
                if (isInclude(file)) {
                  const html = htmlHandler(asset.source().toString(), {
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(html)
                  compilation.updateAsset(file, source)
                }
              }
            }

            if (groupedEntries.js.length) {
              for (let i = 0; i < groupedEntries.js.length; i++) {
                const [file, chunk] = groupedEntries.js[i]
                if (isInclude(file)) {
                  const code = jsHandler(chunk.source().toString(), {
                    runtimeSet,
                    classGenerator
                  }).code
                  const source = new ConcatSource(code)
                  compilation.updateAsset(file, source)
                }
              }
            }

            if (groupedEntries.css.length) {
              for (let i = 0; i < groupedEntries.css.length; i++) {
                const [file, css] = groupedEntries.css[i]
                if (isInclude(file)) {
                  const newCss = cssHandler(css.source().toString(), {
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(newCss)
                  compilation.updateAsset(file, source)
                }
              }
            }
            // overwrite ssr server side chunk
            outputCachedMap.forEach(({ js, html, css }, key) => {
              if (html.size) {
                html.forEach((asset, file) => {
                  if (isInclude(file)) {
                    const html = htmlHandler((asset as sources.Source).source().toString(), {
                      classGenerator,
                      runtimeSet
                    })
                    overwriteServerSideAsset(key, file, html)
                  }
                })
                html.clear()
              }

              if (js.size) {
                js.forEach((chunk, file) => {
                  if (isInclude(file)) {
                    const rawCode = (chunk as sources.Source).source().toString()
                    const code = jsHandler(rawCode, {
                      runtimeSet,
                      classGenerator
                    }).code

                    overwriteServerSideAsset(key, file, code)
                  }
                })
                js.clear()
              }

              if (css.size) {
                css.forEach((style, file) => {
                  if (isInclude(file)) {
                    const newCss = cssHandler((style as sources.Source).source().toString(), {
                      classGenerator,
                      runtimeSet
                    })

                    overwriteServerSideAsset(key, file, newCss)
                  }
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

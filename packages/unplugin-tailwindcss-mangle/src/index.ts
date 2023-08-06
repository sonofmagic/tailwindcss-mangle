import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'
import { getGroupedEntries, cacheDump } from './utils'
import type { OutputAsset, OutputChunk } from 'rollup'
import { cssHandler, htmlHandler, jsHandler } from 'tailwindcss-mangle-core'
import type { sources } from 'webpack'
import path from 'node:path'
import fs from 'node:fs'
import { getOptions } from './options'

export { defaultMangleClassFilter } from 'tailwindcss-mangle-shared'

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
  const { classGenerator, getCachedClassSet, isInclude, classMapOutputOptions, htmlHandlerOptions, jsHandlerOptions, cssHandlerOptions } = getOptions(options)

  return {
    name: pluginName,
    enforce: 'post',
    vite: {
      generateBundle: {
        handler(options, bundle, isWrite) {
          const runtimeSet = getCachedClassSet()
          if (runtimeSet.size === 0) {
            return
          }
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (Array.isArray(groupedEntries.html) && groupedEntries.html.length > 0) {
            for (let i = 0; i < groupedEntries.html.length; i++) {
              const [file, asset] = groupedEntries.html[i] as [string, OutputAsset]
              if (isInclude(file)) {
                asset.source = htmlHandler(asset.source.toString(), {
                  ...htmlHandlerOptions,
                  classGenerator,
                  runtimeSet
                })
              }
            }
          }
          if (Array.isArray(groupedEntries.js) && groupedEntries.js.length > 0) {
            for (let i = 0; i < groupedEntries.js.length; i++) {
              const [file, chunk] = groupedEntries.js[i] as [string, OutputChunk]
              if (isInclude(file)) {
                const code = jsHandler(chunk.code, {
                  ...jsHandlerOptions,
                  runtimeSet,
                  classGenerator
                }).code
                if (code) {
                  chunk.code = code
                }
              }
            }
          }

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [file, css] = groupedEntries.css[i] as [string, OutputAsset]
              if (isInclude(file)) {
                css.source = cssHandler(css.source.toString(), {
                  ...cssHandlerOptions,
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
      const { NormalModule, Compilation } = compiler.webpack
      const { ConcatSource } = compiler.webpack.sources
      function getAssetPath(outputPath: string, file: string, abs: boolean = true) {
        const fn = abs ? path.resolve : path.relative
        return fn(compiler.context, path.resolve(outputPath, file))
      }

      function overwriteServerSideAsset(outputPath: string, file: string, data: string) {
        const abs = getAssetPath(outputPath, file)
        const rel = getAssetPath(outputPath, file, false)
        try {
          fs.writeFileSync(abs, data, 'utf8')
          console.log('[tailwindcss-mangle]: ' + rel + ' overwrited successfully')
        } catch (error) {
          console.log('[tailwindcss-mangle]: ' + rel + ' overwrited fail!')
          console.log(error)
        }
      }

      const twmCssloader = path.resolve(__dirname, 'twm-css.cjs')

      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        NormalModule.getCompilationHooks(compilation).loader.tap(pluginName, (loaderContext, module) => {
          const idx = module.loaders.findIndex((x) => x.loader.includes('css-loader'))
          // vue-loader/dist/stylePostLoader.
          // vue-style-loader
          if (idx > -1) {
            module.loaders.splice(idx + 1, 0, {
              loader: twmCssloader,
              options: {
                classGenerator,
                getCachedClassSet
              },
              ident: null,
              type: null
            })
          }
        })
        compilation.hooks.processAssets.tap(
          {
            name: pluginName,
            stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          },
          (assets) => {
            // nextjs webpack build multiple times
            // server -> manifest -> client

            const runtimeSet = getCachedClassSet()
            const groupedEntries = getGroupedEntries(Object.entries(assets))
            // cache result
            if (runtimeSet.size === 0) {
              const css = new Map()
              const html = new Map()
              const js = new Map()
              for (const [file, source] of groupedEntries.css) {
                css.set(file, source)
              }
              for (const [file, source] of groupedEntries.html) {
                html.set(file, source)
              }
              for (const [file, source] of groupedEntries.js) {
                js.set(file, source)
              }
              if (js.size > 0 || css.size > 0 || html.size > 0) {
                outputCachedMap.set(compiler.outputPath, {
                  css,
                  html,
                  js
                })
              }

              return
            }

            if (groupedEntries.html.length > 0) {
              for (let i = 0; i < groupedEntries.html.length; i++) {
                const [file, asset] = groupedEntries.html[i]
                if (isInclude(file)) {
                  const html = htmlHandler(asset.source().toString(), {
                    ...htmlHandlerOptions,
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(html)
                  compilation.updateAsset(file, source)
                }
              }
            }

            if (groupedEntries.js.length > 0) {
              for (let i = 0; i < groupedEntries.js.length; i++) {
                const [file, chunk] = groupedEntries.js[i]
                if (isInclude(file)) {
                  const code = jsHandler(chunk.source().toString(), {
                    ...jsHandlerOptions,
                    runtimeSet,
                    classGenerator
                  }).code
                  if (code) {
                    const source = new ConcatSource(code)
                    compilation.updateAsset(file, source)
                  }
                }
              }
            }

            if (groupedEntries.css.length > 0) {
              for (let i = 0; i < groupedEntries.css.length; i++) {
                const [file, css] = groupedEntries.css[i]
                if (isInclude(file)) {
                  const newCss = cssHandler(css.source().toString(), {
                    ...cssHandlerOptions,
                    classGenerator,
                    runtimeSet
                  })
                  const source = new ConcatSource(newCss)
                  compilation.updateAsset(file, source)
                }
              }
            }
            // overwrite ssr server side chunk
            for (const [key, { js, html, css }] of outputCachedMap.entries()) {
              if (html.size > 0) {
                for (const [file, asset] of html.entries()) {
                  if (isInclude(file)) {
                    const html = htmlHandler((asset as sources.Source).source().toString(), {
                      ...htmlHandlerOptions,
                      classGenerator,
                      runtimeSet
                    })
                    overwriteServerSideAsset(key, file, html)
                  }
                }
                html.clear()
              }

              if (js.size > 0) {
                for (const [file, chunk] of js.entries()) {
                  if (isInclude(file)) {
                    const rawCode = (chunk as sources.Source).source().toString()
                    const code = jsHandler(rawCode, {
                      ...jsHandlerOptions,
                      runtimeSet,
                      classGenerator
                    }).code
                    if (code) {
                      overwriteServerSideAsset(key, file, code)
                    }
                  }
                }
                js.clear()
              }

              if (css.size > 0) {
                for (const [file, style] of css.entries()) {
                  if (isInclude(file)) {
                    const newCss = cssHandler((style as sources.Source).source().toString(), {
                      ...cssHandlerOptions,
                      classGenerator,
                      runtimeSet
                    })

                    overwriteServerSideAsset(key, file, newCss)
                  }
                }
                css.clear()
              }
            }
          }
        )
      })
    },
    writeBundle() {
      const entries = Object.entries(classGenerator.newClassMap)
      if (entries.length > 0 && classMapOutputOptions) {
        cacheDump(
          classMapOutputOptions.filename,
          entries.map((x) => {
            return [x[0], x[1].name]
          }),
          classMapOutputOptions.dir
        )
      }
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

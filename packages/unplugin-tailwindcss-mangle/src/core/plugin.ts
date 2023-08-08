import { createUnplugin } from 'unplugin'
import type { OutputAsset, OutputChunk } from 'rollup'
import { cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import { getOptions } from './options'
import type { Options } from '@/types'
import { pluginName } from '@/constants'
import { getGroupedEntries, cacheDump } from '@/utils'

export { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'

export const unplugin = createUnplugin((options: Options | undefined = {}) => {
  const { classGenerator, getCachedClassSet, isInclude, classMapOutputOptions, htmlHandlerOptions, jsHandlerOptions, cssHandlerOptions } = getOptions(options)

  return {
    name: pluginName,
    enforce: 'post',
    vite: {
      generateBundle: {
        handler(options, bundle) {
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
      const { Compilation, sources } = compiler.webpack
      const { ConcatSource } = sources

      compiler.hooks.compilation.tap(pluginName, (compilation) => {
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

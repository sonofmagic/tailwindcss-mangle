import { dirname } from 'node:path'
import fs from 'node:fs/promises'
import { createUnplugin } from 'unplugin'
import type { OutputAsset } from 'rollup'
import { htmlHandler, cssHandler, jsHandler, preProcessJs } from '@tailwindcss-mangle/core'
import type { ClassMapOutputOptions, MangleUserConfig } from '@tailwindcss-mangle/config'
import MagicString from 'magic-string'
import { Context } from './context'
import { pluginName } from '@/constants'
import { ensureDir, getGroupedEntries } from '@/utils'

export const unplugin = createUnplugin((options?: MangleUserConfig) => {
  const ctx = new Context(options)
  if (ctx.options.disabled) {
    return {
      name: pluginName
    }
  }
  return {
    name: pluginName,
    enforce: 'pre',
    async buildStart() {
      await ctx.initConfig()
    },
    transformInclude(id) {
      return ctx.isInclude(id)
    },
    transform(code, id) {
      const s = new MagicString(code)
      const replaceMap = ctx.getReplaceMap()
      // 直接忽略 css  文件，因为此时 tailwindcss 还没有展开
      if (/\.[jt]sx?$/.test(id)) {
        return preProcessJs({
          code: s,
          replaceMap,
          addToUsedBy: ctx.addToUsedBy.bind(ctx),
          id
        })
      } else if (ctx.useAC) {
        // should be sort first
        const { arr } = ctx.search(code)
        const markArr: [number, number][] = []
        for (const [cls, ranges] of arr) {
          for (const [start, end] of ranges) {
            const value = replaceMap.get(cls)
            if (value) {
              let flag = true
              for (const [ps, pe] of markArr) {
                if ((start > ps && start < pe) || (end < pe && end > start)) {
                  flag = false
                  break
                }
              }
              if (flag) {
                markArr.push([start, end])
                s.update(start, end, value)
              }
            }
          }
        }
        return s.toString()
      } else {
        // raw replace usage
        for (const [key, value] of replaceMap) {
          code = code.replaceAll(key, value)
        }
        return code
      }
    },
    vite: {
      generateBundle: {
        async handler(options, bundle) {
          const replaceMap = ctx.getReplaceMap()
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [file, cssSource] = groupedEntries.css[i] as [string, OutputAsset]

              const { css } = await cssHandler(cssSource.source.toString(), {
                file,
                replaceMap,
                classGenerator: ctx.classGenerator
              })
              cssSource.source = css
            }
          }
        }
      }
    },
    webpack(compiler) {
      const { Compilation, sources } = compiler.webpack
      const { ConcatSource } = sources

      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        compilation.hooks.processAssets.tapPromise(
          {
            name: pluginName,
            stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          },
          async (assets) => {
            const replaceMap = ctx.getReplaceMap()
            const groupedEntries = getGroupedEntries(Object.entries(assets))

            if (groupedEntries.js.length > 0) {
              for (let i = 0; i < groupedEntries.js.length; i++) {
                const [file, chunk] = groupedEntries.js[i]

                const code = jsHandler(chunk.source().toString(), {
                  replaceMap,
                  classGenerator: ctx.classGenerator
                }).code
                if (code) {
                  const source = new ConcatSource(code)
                  compilation.updateAsset(file, source)
                }
              }
            }

            if (groupedEntries.css.length > 0) {
              for (let i = 0; i < groupedEntries.css.length; i++) {
                const [file, cssSource] = groupedEntries.css[i]

                const { css } = await cssHandler(cssSource.source().toString(), {
                  replaceMap,
                  file,
                  classGenerator: ctx.classGenerator
                })

                const source = new ConcatSource(css)

                compilation.updateAsset(file, source)
              }
            }

            if (groupedEntries.html.length > 0) {
              for (let i = 0; i < groupedEntries.html.length; i++) {
                const [file, asset] = groupedEntries.html[i]

                const html = htmlHandler(asset.source().toString(), {
                  classGenerator: ctx.classGenerator,
                  replaceMap
                })
                const source = new ConcatSource(html)
                compilation.updateAsset(file, source)
              }
            }
          }
        )
      })
    },
    async writeBundle() {
      if (ctx.options.classMapOutput?.enable) {
        const opts = ctx.options.classMapOutput as Required<ClassMapOutputOptions>
        const entries = Object.entries(ctx.classGenerator.newClassMap)
        if (entries.length > 0 && opts) {
          await ensureDir(dirname(opts.filename))
          const output = JSON.stringify(
            entries.map((x) => {
              return {
                origin: x[0],
                replacement: x[1].name,
                usedBy: [...x[1].usedBy]
              }
            }),
            null,
            opts.loose ? 2 : 0
          )
          await fs.writeFile(opts.filename, output, 'utf8')
          console.log(`✨ ${opts.filename} generated!`)
        }
      }
    }
  }
})

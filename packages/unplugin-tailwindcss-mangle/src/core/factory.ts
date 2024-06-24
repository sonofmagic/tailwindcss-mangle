import type { UnpluginFactory } from 'unplugin'
import { Context, cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import { isCSSRequest } from 'is-css-request'
import { createFilter } from '@rollup/pluginutils'
import type { OutputAsset } from 'rollup'
import { pluginName } from '@/constants'
import { getGroupedEntries } from '@/utils'

const factory: UnpluginFactory<MangleUserConfig | undefined> = (options, { framework }) => {
  const ctx = new Context()
  let filter = (_id: string) => true
  return [
    {
      name: `${pluginName}:pre`,
      enforce: 'pre',
      async buildStart() {
        await ctx.initConfig({
          mangleOptions: options,
        })
        filter = createFilter(ctx.options.include, ctx.options.exclude)
      },
    },
    {
      name: `${pluginName}`,
      transformInclude(id) {
        return filter(id)
      },
      async transform(code, id) {
        const opts = {
          ctx,
          id,
        }
        if (/\.[jt]sx?(?:$|\?)/.test(id)) {
          return jsHandler(code, opts)
        }
        else if (/\.(?:vue|svelte)(?:$|\?)/.test(id)) {
          if (isCSSRequest(id)) {
            return await cssHandler(code, opts)
          }
          else {
            return jsHandler(code, opts)
          }
        }
        else if (isCSSRequest(id)) {
          return await cssHandler(code, opts)
        }
        else if (/\.html?/.test(id)) {
          return htmlHandler(code, opts)
        }
      },
    },
    {
      name: `${pluginName}:post`,
      enforce: 'post',
      vite: {
        transformIndexHtml(html) {
          const { code } = htmlHandler(html, { ctx })
          return code
        },
        // generateBundle: {
        //   async handler(options, bundle) {
        //     const groupedEntries = getGroupedEntries(Object.entries(bundle))

        //     if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
        //       for (let i = 0; i < groupedEntries.css.length; i++) {
        //         const [id, cssSource] = groupedEntries.css[i] as [string, OutputAsset]

        //         const { code } = await cssHandler(cssSource.source.toString(), {
        //           id,
        //           ctx,
        //         })
        //         cssSource.source = code
        //       }
        //     }
        //   },
        // },
      },
      webpack(compiler) {
        const { Compilation, sources } = compiler.webpack
        const { ConcatSource } = sources

        compiler.hooks.compilation.tap(pluginName, (compilation) => {
          compilation.hooks.processAssets.tapPromise(
            {
              name: pluginName,
              stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
            },
            async (assets) => {
              const groupedEntries = getGroupedEntries(Object.entries(assets))

              // if (groupedEntries.js.length > 0) {
              //   for (let i = 0; i < groupedEntries.js.length; i++) {
              //     const [file, chunk] = groupedEntries.js[i]

              //     const code = jsHandler(chunk.source().toString(), {
              //       ctx,
              //     }).code
              //     if (code) {
              //       const source = new ConcatSource(code)
              //       compilation.updateAsset(file, source)
              //     }
              //   }
              // }

              if (groupedEntries.css.length > 0) {
                for (let i = 0; i < groupedEntries.css.length; i++) {
                  const [id, cssSource] = groupedEntries.css[i]

                  const { code } = await cssHandler(cssSource.source().toString(), {
                    id,
                    ctx,
                  })

                  const source = new ConcatSource(code)

                  compilation.updateAsset(id, source)
                }
              }

              // if (groupedEntries.html.length > 0) {
              //   for (let i = 0; i < groupedEntries.html.length; i++) {
              //     const [file, asset] = groupedEntries.html[i]

              //     const { code } = htmlHandler(asset.source().toString(), {
              //       ctx,
              //     })
              //     const source = new ConcatSource(code)
              //     compilation.updateAsset(file, source)
              //   }
              // }
            },
          )
        })
      },
      writeBundle() {
        ctx.dump()
      },
    },
  ]
}

export default factory

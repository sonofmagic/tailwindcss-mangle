import type { TransformerOptions } from '@tailwindcss-mangle/config'
import type { UnpluginFactory } from 'unplugin'
import { createFilter } from '@rollup/pluginutils'
import { Context, cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import { isCSSRequest } from 'is-css-request'
import path from 'pathe'
import { getGroupedEntries } from '@/utils'
import { pluginName } from '../constants'

const WEBPACK_LOADER = path.resolve(__dirname, __DEV__ ? '../../dist/loader.cjs' : './loader.cjs')

const factory: UnpluginFactory<TransformerOptions | undefined> = (options) => {
  const ctx = new Context()
  let filter = (_id: string) => true
  return [
    {
      name: `${pluginName}:pre`,
      enforce: 'pre',
      async buildStart() {
        await ctx.initConfig({
          transformerOptions: options,
        })
        filter = createFilter(ctx.options.sources?.include, ctx.options.sources?.exclude)
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
        if (/\.[cm]?[jt]sx?(?:$|\?)/.test(id)) {
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
      webpack(compiler) {
        const { NormalModule } = compiler.webpack
        const isExisted = true
        compiler.hooks.compilation.tap(pluginName, (compilation) => {
          NormalModule.getCompilationHooks(compilation).loader.tap(pluginName, (_loaderContext, module) => {
            if (isExisted) {
              const idx = module.loaders.findIndex(x => x.loader.includes('postcss-loader'))

              if (idx > -1) {
                module.loaders.splice(idx, 0, {
                  loader: WEBPACK_LOADER,
                  ident: null,
                  options: {
                    ctx,
                  },
                  type: null,
                })
              }
            }
          })
        })
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

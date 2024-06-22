import type { UnpluginFactory } from 'unplugin'
import { Context, cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import { isCSSRequest } from 'is-css-request'
import { pluginName } from '@/constants'
// import {createFilter} from '@rollup/pluginutils'

const factory: UnpluginFactory<MangleUserConfig | undefined> = (options) => {
  const ctx = new Context()
  // const filter = createFilter(options?.include, options?.exclude)
  return [
    {
      name: `${pluginName}:pre`,
      // enforce: 'pre',
      async buildStart() {
        await ctx.initConfig({
          mangleOptions: options,
        })
      },
    },
    {
      name: `${pluginName}`,
      transformInclude(id) {
        return !id.includes('node_modules')
      },
      async transform(code, id) {
        if (/\.[jt]sx?(?:$|\?)/.test(id)) {
          return jsHandler(code, {
            ctx,
          })
        }
        else if (/\.(?:vue|svelte)(?:$|\?)/.test(id)) {
          if (isCSSRequest(id)) {
            const { css } = await cssHandler(code, { ctx, file: id })
            return css
          }
          else {
            return jsHandler(code, {
              ctx,
            })
          }
        }
        else if (isCSSRequest(id)) {
          const { css } = await cssHandler(code, { ctx, file: id })
          return css
        }
        else if (/\.html?/.test(id)) {
          return htmlHandler(code, { ctx })
        }
      },
    },
    {
      name: `${pluginName}:post`,
      enforce: 'post',
      vite: {
        transformIndexHtml(code) {
          return htmlHandler(code, { ctx })
        },
      },
    },
  ]
}

export default factory

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
      },
    },
  ]
}

export default factory

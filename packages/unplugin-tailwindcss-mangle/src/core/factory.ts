import type { UnpluginFactory } from 'unplugin'
import { Context, cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import { isCSSRequest } from 'is-css-request'
import { createFilter } from '@rollup/pluginutils'
import { pluginName } from '@/constants'

const factory: UnpluginFactory<MangleUserConfig | undefined> = (options) => {
  const ctx = new Context()
  let filter = (_id: string) => true
  return [
    {
      name: `${pluginName}:pre`,
      // enforce: 'pre',
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
      },
      writeBundle() {
        ctx.dump()
      },
    },
  ]
}

export default factory

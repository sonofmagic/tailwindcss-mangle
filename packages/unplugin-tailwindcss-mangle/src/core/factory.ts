import type { UnpluginFactory } from 'unplugin'
import { Context, cssHandler, preProcessJs, preProcessRawCode, vueHandler } from '@tailwindcss-mangle/core'
import type { MangleUserConfig } from '@tailwindcss-mangle/config'
import MagicString from 'magic-string'
import { pluginName } from '@/constants'

const factory: UnpluginFactory<MangleUserConfig | undefined> = (options) => {
  const ctx = new Context()

  return [
    {
      name: `${pluginName}:pre`,
      enforce: 'pre',
      async buildStart() {
        await ctx.initConfig({
          mangleOptions: options,
        })
      },
      transformInclude(id) {
        return !id.includes('node_modules')
      },
      async transform(code, id) {
        const s = new MagicString(code)
        // 直接忽略 css  文件，因为此时 tailwindcss 还没有展开
        if (/\.[jt]sx?$/.test(id)) {
          return preProcessJs({
            code: s,
            ctx,
            id,
          })
        }
        else if (/\.vue/.test(id)) {
          return vueHandler(code, {
            ctx,
          })
        }
        else {
          return preProcessRawCode({
            code,
            ctx,
            id,
          })
        }
      },
    },
    {
      name: `${pluginName}`,
      transformInclude(id) {
        return !id.includes('node_modules') && id.endsWith('.css')
      },
      async transform(code, id) {
        if (/\.css/.test(id)) {
          const { css } = await cssHandler(code, { ctx, file: id })
          return css
        }
      },
    },
    {
      name: `${pluginName}:post`,
    },
  ]
}

export default factory
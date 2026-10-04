import type { PluginCreator } from 'postcss'
import type parser from 'postcss-selector-parser'
import type { ICssHandlerOptions } from '../types'
import defu from 'defu'

export type PostcssMangleTailwindcssPlugin = PluginCreator<ICssHandlerOptions>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

export function isVueScoped(s: parser.ClassName): boolean {
  if (s.parent) {
    const index = s.parent.nodes.indexOf(s)
    if (index > -1) {
      const nextNode = s.parent.nodes[index + 1]
      if (nextNode && nextNode.type === 'attribute' && nextNode.attribute.includes('data-v-')) {
        return true
      }
    }
  }
  return false
}

export const transformSelectorPostcssPlugin: PluginCreator<ICssHandlerOptions> = function (options) {
  const { ignoreVueScoped, ctx } = defu(options, {
    ignoreVueScoped: true,
  })

  return {
    postcssPlugin,
    Once(root) {
      const native = ctx.getNativeContext('css')
      root.walkRules((rule) => {
        const result = native.transformSelector(rule.selector, ignoreVueScoped)
        if (!result.valid) {
          throw rule.error('Unable to parse the CSS selector')
        }
        for (let index = 0; index < result.preserveCount; index++) {
          rule.cloneBefore()
        }
        rule.selector = result.code
      })
    },

  }
}
transformSelectorPostcssPlugin.postcss = true

import type { ICssHandlerOptions } from '@/types'
import type { PluginCreator } from 'postcss'
import defu from 'defu'
import parser from 'postcss-selector-parser'

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
  const { ignoreVueScoped, ctx, id } = defu(options, {
    ignoreVueScoped: true,
  })

  const replaceMap = ctx.replaceMap

  return {
    postcssPlugin,
    Once(root) {
      root.walkRules((rule) => {
        parser((selectors) => {
          selectors.walkClasses((s) => {
            if (s.value && replaceMap && replaceMap.has(s.value)) {
              if (ignoreVueScoped && isVueScoped(s)) {
                return
              }
              const v = replaceMap.get(s.value)
              if (v) {
                if (ctx.isPreserveClass(s.value)) {
                  rule.cloneBefore()
                }
                // ctx.addToUsedBy(s.value, id)
                s.value = v
              }
            }
          })
        }).transformSync(rule, {
          lossless: false,
          updateSelector: true,
        })
      })
    },

  }
}
transformSelectorPostcssPlugin.postcss = true

import type { PluginCreator } from 'postcss'
import defu from 'defu'
import parser from 'postcss-selector-parser'
import { ICssHandlerOptions } from '@/types'
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

export const transformSelectorPostcssPlugin: PluginCreator<{
  replaceMap: Map<string, string>
}> = function (options) {
  const { ignoreVueScoped, replaceMap } = defu(options, {
    ignoreVueScoped: true
  })

  return {
    postcssPlugin,
    async Rule(rule) {
      await parser((selectors) => {
        selectors.walkClasses((s) => {
          if (s.value && replaceMap && replaceMap.has(s.value)) {
            if (ignoreVueScoped && isVueScoped(s)) {
              return
            }
            const v = replaceMap.get(s.value)
            if (v) {
              s.value = v
            }
          }
        })
      }).transform(rule, {
        lossless: false,
        updateSelector: true
      })
    }
  }
}
transformSelectorPostcssPlugin.postcss = true

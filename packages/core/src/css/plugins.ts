import type { PluginCreator } from 'postcss'
import defu from 'defu'
import parser from 'postcss-selector-parser'
import type { ICssHandlerOptions } from '@/types'

export type PostcssMangleTailwindcssPlugin = PluginCreator<ICssHandlerOptions>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

const clonedKey = '__tw_mangle_cloned__'

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
  const { ignoreVueScoped, replaceMap, ctx } = defu(options, {
    ignoreVueScoped: true,
  })

  return {
    postcssPlugin,
    async Rule(rule) {
      // @ts-ignore
      if (rule[clonedKey]) {
        return
      }
      await parser((selectors) => {
        selectors.walkClasses((s) => {
          if (s.value && replaceMap && replaceMap.has(s.value)) {
            if (ignoreVueScoped && isVueScoped(s)) {
              return
            }
            const v = replaceMap.get(s.value)
            if (v) {
              if (ctx.isPreserveClass(s.value)) {
                const r = rule.cloneBefore()
                // @ts-ignore
                r[clonedKey] = true
              }
              s.value = v
            }
          }
        })
      }).transform(rule, {
        lossless: false,
        updateSelector: true,
      })
    },
  }
}
transformSelectorPostcssPlugin.postcss = true

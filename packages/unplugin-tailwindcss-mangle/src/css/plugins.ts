import { IClassGeneratorContextItem } from '@/types'
import type { PluginCreator } from 'postcss'
import parser from 'postcss-selector-parser'
export type PostcssMangleTailwindcssPlugin = PluginCreator<{
  newClassMap: Record<string, IClassGeneratorContextItem>
}>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

const postcssMangleTailwindcssPlugin: PostcssMangleTailwindcssPlugin = (options) => {
  // must set newClassMap options
  let newClassMap: Record<string, IClassGeneratorContextItem> = {}
  if (options) {
    if (options.newClassMap) {
      newClassMap = options.newClassMap
    }
  }

  return {
    postcssPlugin,
    Rule(rule, helper) {
      rule.selector = parser((selectors) => {
        selectors.walkClasses((s) => {
          if (s.value) {
            const hit = newClassMap[s.value]
            if (hit) {
              // vue scoped
              if (s.parent) {
                const idx = s.parent.nodes.indexOf(s)
                if (idx > -1) {
                  const nextNode = s.parent.nodes[idx + 1]
                  if (nextNode && nextNode.type === 'attribute' && nextNode.attribute.indexOf('data-v-') > -1) {
                    return
                  }
                }
              }
              s.value = hit.name
            }
          }
        })
      }).processSync(rule.selector)
    }
  }
}

postcssMangleTailwindcssPlugin.postcss = true

export { postcssMangleTailwindcssPlugin }

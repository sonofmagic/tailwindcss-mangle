import { IMangleContextClass } from '@/types'
import type { PluginCreator } from 'postcss'
import parser from 'postcss-selector-parser'
export type PostcssMangleTailwindcssPlugin = PluginCreator<{
  newClassMap: Record<string, IMangleContextClass>
}>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

const postcssMangleTailwindcssPlugin: PostcssMangleTailwindcssPlugin = (options) => {
  // must set newClassMap options
  let newClassMap: Record<string, IMangleContextClass> = {}
  if (options) {
    if (options.newClassMap) {
      newClassMap = options.newClassMap
    }
  }

  return {
    postcssPlugin,
    Rule(rule, helper) {
      rule.selector = parser((selectors) => {
        selectors.walk((s) => {
          if (s.value) {
            const hit = newClassMap[s.value]
            if (hit) {
              // console.log(s.value, hit.name)
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

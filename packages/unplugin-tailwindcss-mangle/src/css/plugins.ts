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
              // console.log(s.value, hit.name)
              s.value = hit.name
            }
            // for vue scoped gap-y-4[data-v-0f84999b]
            // const idx = s.value.indexOf('[data-v-')
            // const isVueScoped = idx > -1
            // if (isVueScoped) {
            //   const prefixCls = s.value.substring(0, idx)
            //   const hit = newClassMap[prefixCls]
            //   if (hit) {
            //     s.value = hit.name + s.value.substring(idx)
            //   }
            // } else {
            //   const hit = newClassMap[s.value]
            //   if (hit) {
            //     // console.log(s.value, hit.name)
            //     s.value = hit.name
            //   }
            // }
          }
        })
      }).processSync(rule.selector)
    }
  }
}

postcssMangleTailwindcssPlugin.postcss = true

export { postcssMangleTailwindcssPlugin }

import { IClassGeneratorContextItem, ICssHandlerOptions } from '@/types'
import type { PluginCreator } from 'postcss'

import parser from 'postcss-selector-parser'
export type PostcssMangleTailwindcssPlugin = PluginCreator<ICssHandlerOptions>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

const postcssMangleTailwindcssPlugin: PostcssMangleTailwindcssPlugin = (options) => {
  if (options?.scene === 'loader') {
    // must set newClassMap options
    let set: Set<string> = new Set()

    if (options) {
      if (options.runtimeSet) {
        set = options.runtimeSet
      }
    }
    return {
      postcssPlugin,
      Rule(rule, helper) {
        rule.selector = parser((selectors) => {
          selectors.walkClasses((s) => {
            if (s.value) {
              const existed = set.has(s.value)

              if (existed) {
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
                s.value = options.classGenerator.generateClassName(s.value).name
              }
            }
          })
        }).processSync(rule.selector)
      }
    }
  } else {
    let newClassMap: Record<string, IClassGeneratorContextItem> = {}

    if (options) {
      if (options.classGenerator) {
        newClassMap = options.classGenerator.newClassMap
      }
    }

    return {
      postcssPlugin,
      Rule(rule, helper) {
        rule.selector = parser((selectors) => {
          selectors.walkClasses((s) => {
            if (s.value) {
              const hit = newClassMap[s.value]
              const existed = Boolean(hit)

              if (existed) {
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
}

postcssMangleTailwindcssPlugin.postcss = true

export { postcssMangleTailwindcssPlugin }

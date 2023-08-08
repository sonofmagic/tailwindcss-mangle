import type { PluginCreator } from 'postcss'
import defu from 'defu'
import parser from 'postcss-selector-parser'
import { IClassGeneratorContextItem, ICssHandlerOptions } from '@/types'
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

const postcssMangleTailwindcssPlugin: PostcssMangleTailwindcssPlugin = (options) => {
  const { ignoreVueScoped } = defu(options, {
    ignoreVueScoped: true
  })
  if (options?.scene === 'loader') {
    // must set newClassMap options
    let set: Set<string> = new Set()

    if (options && options.runtimeSet) {
      set = options.runtimeSet
    }
    return {
      postcssPlugin,
      Rule(rule) {
        rule.selector = parser((selectors) => {
          selectors.walkClasses((s) => {
            if (s.value) {
              const existed = set.has(s.value)

              if (existed) {
                if (ignoreVueScoped && isVueScoped(s)) {
                  return
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

    if (options && options.classGenerator) {
      newClassMap = options.classGenerator.newClassMap
    }

    return {
      postcssPlugin,
      Rule(rule) {
        rule.selector = parser((selectors) => {
          selectors.walkClasses((s) => {
            if (s.value) {
              const hit = newClassMap[s.value]
              const existed = Boolean(hit)

              if (existed) {
                if (ignoreVueScoped && isVueScoped(s)) {
                  return
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

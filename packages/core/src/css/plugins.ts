import type { PluginCreator } from 'postcss'
import type { ICssHandlerOptions } from '../types'
import defu from 'defu'
import parser from 'postcss-selector-parser'

export type PostcssMangleTailwindcssPlugin = PluginCreator<ICssHandlerOptions>

const postcssPlugin = 'postcss-mangle-tailwindcss-plugin'

function unescapeCssClassName(value: string) {
  return value.replace(/\\([^\n\r\f0-9a-f])/gi, '$1')
}

function resolveReplacement(replaceMap: Map<string, string>, value: string) {
  if (replaceMap.has(value)) {
    return {
      original: value,
      replacement: replaceMap.get(value),
    }
  }

  const unescapedValue = unescapeCssClassName(value)
  if (unescapedValue !== value && replaceMap.has(unescapedValue)) {
    return {
      original: unescapedValue,
      replacement: replaceMap.get(unescapedValue),
    }
  }
}

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

  const replaceMap = ctx.replaceMap

  return {
    postcssPlugin,
    Once(root) {
      root.walkRules((rule) => {
        parser((selectors) => {
          selectors.walkClasses((s) => {
            const resolved = s.value && replaceMap ? resolveReplacement(replaceMap, s.value) : undefined
            if (resolved) {
              if (ignoreVueScoped && isVueScoped(s)) {
                return
              }
              const v = resolved.replacement
              if (v) {
                if (ctx.isPreserveClass(resolved.original)) {
                  rule.cloneBefore()
                }
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

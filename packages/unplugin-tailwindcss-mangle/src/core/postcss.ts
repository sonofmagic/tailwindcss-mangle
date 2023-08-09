import postcss, { type PluginCreator } from 'postcss'
import parser from 'postcss-selector-parser'

const transformSelectorPostcssPlugin: PluginCreator<{
  replaceMap: Map<string, string>
}> = function (options) {
  const { replaceMap } = options ?? {}
  return {
    postcssPlugin: 'postcssTransformSelectorPlugin',
    async Rule(rule) {
      await parser((selectors) => {
        selectors.walkClasses((s) => {
          if (s.value && replaceMap && replaceMap.has(s.value)) {
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

export function processCss(options: { replaceMap: Map<string, string>; css: string; file: string }) {
  const { css, file, replaceMap } = options
  return postcss([
    transformSelectorPostcssPlugin({
      replaceMap
    })
  ]).process(css, {
    from: file,
    to: file
  })
}

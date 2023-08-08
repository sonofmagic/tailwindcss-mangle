import { SourceMapCompact, createUnplugin } from 'unplugin'
import type { OutputAsset, OutputChunk, SourceMapInput } from 'rollup'
import { cssHandler, htmlHandler, jsHandler } from '@tailwindcss-mangle/core'
import parser from 'postcss-selector-parser'
import postcss, { type PluginCreator } from 'postcss'
// import MagicString from 'magic-string'
import { getOptions } from './options'
import type { Options, ReplaceEntity } from '@/types'
import { pluginName } from '@/constants'
import { getGroupedEntries, cacheDump } from '@/utils'
export { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'

const transformSelectorPostcssPlugin: PluginCreator<{
  replaceMap: Map<string, string>
}> = function (options) {
  const { replaceMap } = options ?? {}
  return {
    postcssPlugin: 'transformSelectorPostcssPlugin',
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

export const unplugin = createUnplugin((options: Options | undefined = {}) => {
  const { isInclude, initConfig, getReplaceMap } = getOptions(options)

  return {
    name: pluginName,
    enforce: 'post',
    async buildStart() {
      await initConfig()
    },
    transform(code, id) {
      const replaceMap = getReplaceMap()
      // 直接忽略 css  文件，因为此时 tailwindcss 还没有展开
      // if (id.endsWith('.css')) {
      //   const { css, map } = await postcss([
      //     transformSelectorPostcssPlugin({
      //       replaceMap
      //     })
      //   ]).process(code, {
      //     from: id,
      //     to: id,
      //     map: true
      //   })

      //   return {
      //     code: css,
      //     map
      //   }
      // } else {
      for (const [key, value] of replaceMap) {
        code = code.replaceAll(key, value)
      }
      // const s = new MagicString(code)
      return code
      //  {
      //   code: s.toString(),
      //   map: s.generateMap()
      // }
      // }
    },
    vite: {
      generateBundle: {
        async handler(options, bundle) {
          const replaceMap = getReplaceMap()
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [file, cssSource] = groupedEntries.css[i] as [string, OutputAsset]

              const { css } = await postcss([
                transformSelectorPostcssPlugin({
                  replaceMap
                })
              ]).process(cssSource.source.toString(), {
                from: file,
                to: file
              })
              cssSource.source = css
            }
          }
        }
      }
    },
    webpack(compiler) {
      const { Compilation, sources } = compiler.webpack
      const { ConcatSource } = sources

      compiler.hooks.compilation.tap(pluginName, (compilation) => {
        compilation.hooks.processAssets.tapPromise(
          {
            name: pluginName,
            stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
          },
          async (assets) => {
            const replaceMap = getReplaceMap()
            const groupedEntries = getGroupedEntries(Object.entries(assets))

            if (groupedEntries.css.length > 0) {
              for (let i = 0; i < groupedEntries.css.length; i++) {
                const [file, cssSource] = groupedEntries.css[i]
                // CachedSource，如何获取内容
                const { css } = await postcss([
                  transformSelectorPostcssPlugin({
                    replaceMap
                  })
                ]).process(cssSource.source().toString(), {
                  from: file,
                  to: file
                })

                const source = new ConcatSource(css)
                compilation.updateAsset(file, source)
              }
            }
          }
        )
      })
    }
  }
})

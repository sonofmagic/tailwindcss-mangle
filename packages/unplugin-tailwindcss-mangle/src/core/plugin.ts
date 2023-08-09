import { createUnplugin } from 'unplugin'
import type { OutputAsset } from 'rollup'
import { getOptions } from './options'
// import { svelteToTsx } from './svelte-to-tsx'
// import { vueToTsx } from './vue-to-tsx'
import { processJs } from './babel'
import { processCss } from './postcss'
import type { Options } from '@/types'
import { pluginName } from '@/constants'
import { cacheDump, getGroupedEntries } from '@/utils'
export { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'

export const unplugin = createUnplugin((options: Options | undefined = {}) => {
  const { isInclude, initConfig, getReplaceMap, classGenerator, addToUsedBy, classMapOutputOptions } = getOptions(options)

  return {
    name: pluginName,
    enforce: 'pre',
    async buildStart() {
      await initConfig()
    },
    transformInclude(id) {
      return isInclude(id)
    },
    transform(code, id) {
      const replaceMap = getReplaceMap()
      // 直接忽略 css  文件，因为此时 tailwindcss 还没有展开
      if (id.endsWith('.js') || id.endsWith('.ts') || id.endsWith('.tsx') || id.endsWith('.jsx')) {
        const str = processJs({
          code,
          replaceMap,
          addToUsedBy,
          id
        })
        return str
      } else {
        for (const [key, value] of replaceMap) {
          code = code.replaceAll(key, value)
        }
      }

      return code
    },
    vite: {
      generateBundle: {
        async handler(options, bundle) {
          const replaceMap = getReplaceMap()
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (Array.isArray(groupedEntries.css) && groupedEntries.css.length > 0) {
            for (let i = 0; i < groupedEntries.css.length; i++) {
              const [file, cssSource] = groupedEntries.css[i] as [string, OutputAsset]

              const { css } = await processCss({
                css: cssSource.source.toString(),
                file,
                replaceMap
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

                const { css } = await processCss({
                  css: cssSource.source().toString(),
                  replaceMap,
                  file
                })

                const source = new ConcatSource(css)
                compilation.updateAsset(file, source)
              }
            }
          }
        )
      })
    },
    writeBundle() {
      const entries = Object.entries(classGenerator.newClassMap)
      if (entries.length > 0 && classMapOutputOptions) {
        cacheDump(
          classMapOutputOptions.filename,
          entries.map((x) => {
            return {
              origin: x[0],
              replacement: x[1].name,
              usedBy: [...x[1].usedBy]
            }
          }),
          classMapOutputOptions.dir
        )
      }
    }
  }
})

import { createUnplugin } from 'unplugin'
import type { Options } from './types'
import { pluginName } from './constants'
import { getClassCacheSet } from 'tailwindcss-patch'
import { parse, serialize } from 'parse5'
import { traverse } from '@parse5/tools'
import { getGroupedEntries } from './utils'
import { OutputAsset, OutputChunk } from 'rollup'
import ClassGenerator from './classGenerator'
import { jsHandler } from './handlers/js'
const unplugin = createUnplugin((options: Options = {}, meta) => {
  let classSet: Set<string>
  let cached: boolean
  const clsGen = new ClassGenerator()
  function getCachedClassSet() {
    if (cached) {
      return classSet
    }
    const set = getClassCacheSet()
    classSet = set
    cached = true
    return classSet
  }
  return {
    name: pluginName,
    enforce: 'post',
    vite: {
      generateBundle: {
        handler(options, bundle, isWrite) {
          const runtimeSet = getCachedClassSet()
          const groupedEntries = getGroupedEntries(Object.entries(bundle))

          if (groupedEntries.html.length) {
            for (let i = 0; i < groupedEntries.html.length; i++) {
              const [, asset] = groupedEntries.html[i] as [string, OutputAsset]
              const fragment = parse(asset.source.toString())
              traverse(fragment, {
                element(node, parent) {
                  const attr = node.attrs.find((x) => x.name === 'class')
                  if (attr) {
                    const arr = attr.value.split(/\s/).filter((x) => x)
                    attr.value = arr
                      .map((x) => {
                        if (runtimeSet.has(x)) {
                          return clsGen.generateClassName(x).name
                        }
                        return x
                      })
                      .join(' ')
                  }
                }
              })
              const newCode = serialize(fragment)
              asset.source = newCode
            }
          }
          if (groupedEntries.js.length) {
            for (let i = 0; i < groupedEntries.js.length; i++) {
              const [, chunk] = groupedEntries.js[i] as [string, OutputChunk]
              const newCode = jsHandler(chunk.code, {
                set: runtimeSet,
                classGenerator: clsGen
              }).code
              chunk.code = newCode
            }
          }

          if (groupedEntries.css.length) {
          }
        }
      }
    }
  }
})
export default unplugin
export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild
// export const vitePlugin = unplugin.vite
// export const rollupPlugin = unplugin.rollup
// export const webpackPlugin = unplugin.webpack
// export const rspackPlugin = unplugin.rspack
// export const esbuildPlugin = unplugin.esbuild

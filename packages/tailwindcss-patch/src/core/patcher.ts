import type { PatchUserConfig } from '@tailwindcss-mangle/config'
import type { InternalCacheOptions, InternalPatchOptions, PackageInfo, TailwindcssClassCache, TailwindcssPatcherOptions, TailwindcssRuntimeContext } from '../types'
import { createRequire } from 'node:module'
import process from 'node:process'
import fs from 'fs-extra'
import { getPackageInfoSync } from 'local-pkg'
import path from 'pathe'
import { getPatchOptions } from '../defaults'
import logger from '../logger'
import { isObject } from '../utils'
import { CacheManager, getCacheOptions } from './cache'
import { extractValidCandidates } from './candidates'
import { processTailwindcss } from './postcss'
import { internalPatch } from './runtime'

const require = createRequire(import.meta.url)
export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions: InternalPatchOptions
  public patch: () => void
  public cacheManager: CacheManager
  public packageInfo: PackageInfo
  public majorVersion?: number

  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    this.cacheOptions = getCacheOptions(options.cache)
    this.patchOptions = getPatchOptions(options.patch)

    this.cacheManager = new CacheManager(this.cacheOptions)

    const packageInfo = getPackageInfoSync('tailwindcss')

    if (!packageInfo) {
      throw new Error('tailwindcss not found')
    }

    if (packageInfo.version) {
      this.majorVersion = Number.parseInt(packageInfo.version[0])
    }
    this.packageInfo = packageInfo
    this.patch = () => {
      try {
        return internalPatch(this.packageInfo?.packageJsonPath, this.patchOptions)
      }
      catch (error) {
        logger.error(`patch tailwindcss failed: ${(<Error>error).message}`)
      }
    }
  }

  setCache(set: Set<string>) {
    if (this.cacheOptions.enable) {
      return this.cacheManager.write(set)
    }
  }

  getCache() {
    return this.cacheManager.read()
  }

  getContexts(): TailwindcssRuntimeContext[] {
    if (this.packageInfo) {
      const distPath = path.join(this.packageInfo.rootPath, 'lib')
      let injectFilePath: string | undefined
      if (this.majorVersion === 2) {
        injectFilePath = path.join(distPath, 'jit/index.js')
      }
      else if (this.majorVersion === 3) {
        injectFilePath = path.join(distPath, 'plugin.js')
        if (!fs.existsSync(injectFilePath)) {
          injectFilePath = path.join(distPath, 'index.js')
        }
      }
      if (injectFilePath) {
        const mo = require(injectFilePath)
        if (mo.contextRef) {
          return mo.contextRef.value
        }
      }
    }

    return []
  }

  getClassCaches(): TailwindcssClassCache[] {
    const contexts = this.getContexts()
    return contexts.filter(x => isObject(x)).map(x => x.classCache)
  }

  async getClassCacheSet(options?: PatchUserConfig): Promise<Set<string>> {
    const classSet = new Set<string>()
    const { output, tailwindcss } = options ?? {}
    if (this.majorVersion === 4) {
      const { v4 } = tailwindcss ?? {}
      if (Array.isArray(v4?.cssEntries)) {
        const results = (
          await Promise.all(
            v4
              .cssEntries
              .map(async (x) => {
                if (await fs.exists(x)) {
                  const css = await fs.readFile(x, 'utf8')
                  return css
                }
                return false
              }),
          )
        ).filter(x => x) as string[]
        for (const css of results) {
          const candidates = await extractValidCandidates({
            base: v4?.base,
            css,
            sources: v4?.sources?.map((x) => {
              return {
                base: x.base ?? v4?.base ?? process.cwd(),
                pattern: x.pattern,
              }
            }),
          })
          for (const candidate of candidates) {
            classSet.add(candidate)
          }
        }
      }
      else {
        const candidates = await extractValidCandidates({
          base: v4?.base,
          css: v4?.css,
          sources: v4?.sources?.map((x) => {
            return {
              base: x.base ?? v4?.base ?? process.cwd(),
              pattern: x.pattern,
            }
          }),
        })
        for (const candidate of candidates) {
          classSet.add(candidate)
        }
      }
    }
    else {
      const classCaches = this.getClassCaches()

      for (const classCacheMap of classCaches) {
        const keys = classCacheMap.keys()
        for (const key of keys) {
          const v = key.toString()
          if (output?.removeUniversalSelector && v === '*') {
            continue
          }
          classSet.add(v)
        }
      }
    }

    return classSet
  }

  /**
   * @description 在多个 tailwindcss 上下文时，这个方法将被执行多次，所以策略上应该使用 append
   */
  async getClassSet(options?: PatchUserConfig) {
    const { output, tailwindcss } = options ?? {}
    const cacheStrategy = this.cacheOptions.strategy ?? 'merge'
    const set = await this.getClassCacheSet({
      output,
      tailwindcss,
    })
    if (cacheStrategy === 'overwrite') {
      set.size > 0 && this.setCache(set)
    }
    else if (cacheStrategy === 'merge') {
      const cacheSet = this.getCache()
      if (cacheSet) {
        for (const x of cacheSet) {
          set.add(x)
        }
      }
      this.setCache(set)
    }

    return set
  }

  async extract(options?: PatchUserConfig) {
    const { output, tailwindcss } = options ?? {}
    if (output && tailwindcss) {
      const { filename, loose } = output

      if (this.majorVersion === 3) {
        await processTailwindcss({
          ...tailwindcss,
          majorVersion: this.majorVersion,
        })
      }

      const set = await this.getClassSet({
        output,
        tailwindcss,
      })
      if (filename) {
        const classList = [...set]
        await fs.outputJSON(filename, classList, {
          spaces: loose ? 2 : undefined,
        })
        return filename
      }
    }
  }

  extractValidCandidates = extractValidCandidates
}

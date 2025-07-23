import type { PackageInfo } from 'local-pkg'
import type { InternalCacheOptions, InternalPatchOptions, TailwindcssClassCache, TailwindcssPatcherOptions, TailwindcssRuntimeContext } from '../types'
import { createRequire } from 'node:module'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'
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

export interface PatchExtractOptions {
  write?: boolean
}

const require = createRequire(import.meta.url)
export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions: InternalPatchOptions
  public patch: () => void
  public cacheManager: CacheManager
  public packageInfo: PackageInfo
  public majorVersion?: number
  public filter?: (className: string) => boolean

  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    this.cacheOptions = getCacheOptions(options.cache)
    this.patchOptions = getPatchOptions(options.patch)

    this.cacheManager = new CacheManager(this.cacheOptions)
    this.filter = function filter(className: string) {
      if (this.patchOptions.output?.removeUniversalSelector && className === '*') {
        return false
      }
      return Boolean(this.patchOptions.filter?.(className))
    }
    const packageInfo = getPackageInfoSync(
      this.patchOptions.packageName ?? 'tailwindcss',
      this.patchOptions.resolve,
    )

    if (!packageInfo) {
      throw new Error('tailwindcss not found')
    }

    if (packageInfo.version) {
      this.majorVersion = Number.parseInt(packageInfo.version[0])
    }
    if (this.patchOptions.tailwindcss?.version) {
      this.majorVersion = this.patchOptions.tailwindcss.version
    }
    this.packageInfo = packageInfo as PackageInfo
    this.patch = () => {
      try {
        return internalPatch(this.packageInfo, this.patchOptions)
      }
      catch (error) {
        logger.error(`Patch Tailwind CSS Failed: ${(<Error>error).message}`)
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

  async getClassCacheSet(): Promise<Set<string>> {
    const classSet = new Set<string>()
    const { tailwindcss } = this.patchOptions
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
                negated: x.negated,
              }
            }),
          })
          for (const candidate of candidates) {
            this.filter?.(candidate) && classSet.add(candidate)
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
              negated: x.negated,
            }
          }),
        })
        for (const candidate of candidates) {
          this.filter?.(candidate) && classSet.add(candidate)
        }
      }
    }
    else {
      const classCaches = this.getClassCaches()

      for (const classCacheMap of classCaches) {
        const keys = classCacheMap.keys()
        for (const key of keys) {
          const v = key.toString()
          this.filter?.(v) && classSet.add(v)
        }
      }
    }

    return classSet
  }

  getClassCacheSetV3(): Set<string> {
    const classSet = new Set<string>()

    const classCaches = this.getClassCaches()

    for (const classCacheMap of classCaches) {
      const keys = classCacheMap.keys()
      for (const key of keys) {
        const v = key.toString()
        this.filter?.(v) && classSet.add(v)
      }
    }

    return classSet
  }

  /**
   * @description 在多个 tailwindcss 上下文时，这个方法将被执行多次，所以策略上应该使用 append
   */
  async getClassSet() {
    const cacheStrategy = this.cacheOptions.strategy ?? 'merge'
    const set = await this.getClassCacheSet()
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

  getClassSetV3() {
    const cacheStrategy = this.cacheOptions.strategy ?? 'merge'
    const set = this.getClassCacheSetV3()
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

  async extract(options?: PatchExtractOptions) {
    const { write } = defu<PatchExtractOptions, PatchExtractOptions[]>(options, { write: true })
    const { output, tailwindcss } = this.patchOptions
    if (output && tailwindcss) {
      const { filename, loose } = output
      // tailwindcss v2 + v3
      if (this.majorVersion === 3 || this.majorVersion === 2) {
        await processTailwindcss({
          ...tailwindcss,
          majorVersion: this.majorVersion,
        })
      }

      const classSet = await this.getClassSet()
      if (filename) {
        const classList = [...classSet]
        if (write) {
          await fs.outputJSON(filename, classList, {
            spaces: loose ? 2 : undefined,
          })
        }
        return {
          filename,
          classList,
          classSet,
        }
      }
    }
  }

  extractValidCandidates = extractValidCandidates
}

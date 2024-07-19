import path from 'node:path'
import fs from 'fs-extra'
import { CacheManager, getCacheOptions } from './cache'
import { internalPatch } from './runtime'
import { processTailwindcss } from './postcss'
import type { UserConfig } from '@/config'
import { getPatchOptions } from '@/defaults'
import { getPackageInfoSync, isObject } from '@/utils'
import type { CacheStrategy, InternalCacheOptions, InternalPatchOptions, PackageInfo, TailwindcssClassCache, TailwindcssPatcherOptions, TailwindcssRuntimeContext } from '@/types'

export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions: InternalPatchOptions
  public patch: () => void
  public cacheManager: CacheManager
  public packageInfo?: PackageInfo
  public majorVersion?: number

  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    this.cacheOptions = getCacheOptions(options.cache)
    this.patchOptions = getPatchOptions(options.patch)

    this.cacheManager = new CacheManager(this.cacheOptions)
    this.packageInfo = getPackageInfoSync('tailwindcss', { basedir: this.patchOptions.basedir })
    if (this.packageInfo && this.packageInfo.version) {
      this.majorVersion = Number.parseInt(this.packageInfo.version[0])
    }
    this.patch = () => {
      try {
        return internalPatch(this.packageInfo?.packageJsonPath, this.patchOptions)
      }
      catch (error) {
        console.error(`patch tailwindcss failed: ${(<Error>error).message}`)
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
      else {
        injectFilePath = path.join(distPath, 'plugin.js')
        if (!fs.existsSync(injectFilePath)) {
          injectFilePath = path.join(distPath, 'index.js')
        }
      }
      if (injectFilePath) {
        // eslint-disable-next-line ts/no-require-imports, ts/no-var-requires
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

  getClassCacheSet(options?: { removeUniversalSelector?: boolean }): Set<string> {
    const classCaches = this.getClassCaches()
    const classSet = new Set<string>()
    for (const classCacheMap of classCaches) {
      const keys = classCacheMap.keys()
      for (const key of keys) {
        const v = key.toString()
        if (options?.removeUniversalSelector && v === '*') {
          continue
        }
        classSet.add(v)
      }
    }
    return classSet
  }

  /**
   * @description 在多个 tailwindcss 上下文时，这个方法将被执行多次，所以策略上应该使用 append
   */
  getClassSet(options?: { cacheStrategy?: CacheStrategy, removeUniversalSelector?: boolean }) {
    const { cacheStrategy = this.cacheOptions.strategy ?? 'merge', removeUniversalSelector = true } = options ?? {}
    const set = this.getClassCacheSet({
      removeUniversalSelector,
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

  async extract(options?: UserConfig['patch']) {
    const { output, tailwindcss } = options ?? {}
    if (output && tailwindcss) {
      const { removeUniversalSelector, filename, loose } = output

      await processTailwindcss(tailwindcss)

      const set = this.getClassSet({
        removeUniversalSelector,
      })
      if (filename) {
        await fs.ensureDir(path.dirname(filename))
        const classList = [...set]
        fs.writeFileSync(filename, JSON.stringify(classList, null, loose ? 2 : undefined), 'utf8')
        return filename
      }
    }
  }
}

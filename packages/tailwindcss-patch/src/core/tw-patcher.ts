import { getClassCacheSet, getContexts, getTailwindcssEntry } from './exposeContext'
import type { InternalCacheOptions, InternalPatchOptions, TailwindcssPatcherOptions, CacheStrategy } from '../types'
import { CacheManager, getCacheOptions } from './cache'
import { createPatch, getPatchOptions } from './runtime-patcher'

export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions: InternalPatchOptions
  public patch: () => void
  public cacheManager: CacheManager
  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    this.cacheOptions = getCacheOptions(options.cache)
    this.patchOptions = getPatchOptions(options.patch)
    this.patch = createPatch(this.patchOptions)
    this.cacheManager = new CacheManager(this.cacheOptions)
  }

  getPkgEntry(basedir?: string) {
    return getTailwindcssEntry(basedir)
  }

  setCache(set: Set<string>) {
    if (this.cacheOptions.enable) {
      return this.cacheManager.write(set)
    }
  }

  getCache() {
    // if(this.cache.enable){
    return this.cacheManager.read()
    // }
  }

  /**
   * @description 在多个 tailwindcss 上下文时，这个方法将被执行多次，所以策略上应该使用 append
   * 详见 taro weapp-tailwindcss 独立分包
   * @param basedir
   * @returns
   */
  getClassSet(
    options: {
      basedir?: string
      cacheStrategy?: CacheStrategy
    } = {
      cacheStrategy: this.cacheOptions.strategy ?? 'merge'
    }
  ) {
    const { basedir, cacheStrategy } = options
    const set = getClassCacheSet(basedir)
    if (cacheStrategy === 'overwrite') {
      set.size > 0 && this.setCache(set)
    } else if (cacheStrategy === 'merge') {
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

  getContexts(basedir?: string) {
    return getContexts(basedir)
  }
}

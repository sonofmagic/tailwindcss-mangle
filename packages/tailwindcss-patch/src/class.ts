import { getClassCacheSet, getContexts, getTailwindcssEntry } from './exposeContext'
import type { CacheOptions, PatchOptions, InternalCacheOptions } from './type'
import { writeCache, readCache } from './cache'
import { createPatch } from './patcher'

export interface TailwindcssPatcherOptions {
  cache?: CacheOptions
  patch?: PatchOptions
}

export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions?: PatchOptions
  public patch: () => void
  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    let cache: InternalCacheOptions
    switch (typeof options.cache) {
      case 'undefined': {
        cache = {
          enable: false
        }
        break
      }
      case 'boolean': {
        cache = {
          enable: options.cache
        }
        break
      }
      case 'object': {
        cache = { ...options.cache, enable: true }
        break
      }
    }
    this.cacheOptions = cache
    this.patchOptions = options.patch
    this.patch = createPatch(options.patch)
  }

  getPkgEntry(basedir?: string) {
    return getTailwindcssEntry(basedir)
  }

  setCache(set: Set<string>) {
    if (this.cacheOptions.enable) {
      return writeCache(set, this.cacheOptions)
    }
  }

  getCache() {
    // if(this.cache.enable){
    return readCache(this.cacheOptions)
    // }
  }

  getClassSet(basedir?: string) {
    const set = getClassCacheSet(basedir)
    set.size && this.setCache(set)
    return set
  }

  getContexts(basedir?: string) {
    return getContexts(basedir)
  }
}

import { getClassCacheSet, getContexts, getTailwindcssEntry } from './exposeContext'
import type { CacheOptions, InternalCacheOptions, InternalPatchOptions, TailwindcssPatcherOptions } from './type'
import { writeCache, readCache } from './cache'
import { createPatch, getPatchOptions } from './patcher'

export function getCacheOptions(options?: CacheOptions | boolean) {
  let cache: InternalCacheOptions
  switch (typeof options) {
    case 'undefined': {
      cache = {
        enable: false
      }
      break
    }
    case 'boolean': {
      cache = {
        enable: options
      }
      break
    }
    case 'object': {
      cache = { ...options, enable: true }
      break
    }
  }
  return cache
}
export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cacheOptions: InternalCacheOptions
  public patchOptions: InternalPatchOptions
  public patch: () => void
  constructor(options: TailwindcssPatcherOptions = {}) {
    this.rawOptions = options
    this.cacheOptions = getCacheOptions(options.cache)
    this.patchOptions = getPatchOptions(options.patch)
    this.patch = createPatch(this.patchOptions)
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

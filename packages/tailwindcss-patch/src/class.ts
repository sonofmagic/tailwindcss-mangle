import { getClassCacheSet, getContexts, getTailwindcssEntry } from './exposeContext'
import type { InternalCacheOptions } from './type'
import { writeCache, readCache } from './cache'

export interface TailwindcssPatcherOptions {
  cache?: InternalCacheOptions
}

export class TailwindcssPatcher {
  public rawOptions: TailwindcssPatcherOptions
  public cache: InternalCacheOptions
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
    this.cache = cache
  }

  getPkgEntry(basedir?: string) {
    return getTailwindcssEntry(basedir)
  }

  setCache(set: Set<string>) {
    if (this.cache.enable) {
      return writeCache(set, this.cache)
    }
  }

  getCache() {
    // if(this.cache.enable){
    return readCache(this.cache)
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

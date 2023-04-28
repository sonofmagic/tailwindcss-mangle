import { getClassCacheSet, getContexts, getTailwindcssEntry } from './exposeContext'
import type { CacheOptions } from './type'

type InternalCacheOptions = CacheOptions & { enable: boolean }

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

  getClassSet(basedir?: string) {
    const set = getClassCacheSet(basedir)
    return set
  }

  getContexts(basedir?: string) {
    return getContexts(basedir)
  }
}

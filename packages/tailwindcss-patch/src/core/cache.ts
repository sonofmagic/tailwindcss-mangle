import type { CacheOptions, InternalCacheOptions } from '../types'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { pkgName } from '../constants'
import logger from '../logger'

export function getCacheOptions(options?: CacheOptions | boolean) {
  let cache: InternalCacheOptions
  switch (typeof options) {
    case 'undefined': {
      cache = {
        enable: false,
      }
      break
    }
    case 'boolean': {
      cache = {
        enable: options,
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

export class CacheManager {
  public options: Required<CacheOptions> & { filename: string }

  constructor(options: CacheOptions = {}) {
    this.options = this.getOptions(options)
  }

  getOptions(options: CacheOptions = {}): Required<CacheOptions> & { filename: string } {
    const cwd = options.cwd ?? process.cwd()
    const dir = options.dir ?? path.resolve(cwd, 'node_modules/.cache', pkgName)
    const file = options.file ?? 'index.json'
    const filename = path.resolve(dir, file)
    return {
      cwd,
      dir,
      file,
      filename,
      strategy: 'merge',
    }
  }

  async write(data: Set<string>) {
    try {
      const { filename } = this.options
      await fs.outputJSON(filename, [...data])
      return filename
    }
    catch (error) {
      logger.error(error)
    }
  }

  async read() {
    const { filename } = this.options
    const isExisted = await fs.exists(filename)
    try {
      if (isExisted) {
        const data = await fs.readJSON(filename)
        return new Set<string>(data ?? [])
      }
    }
    catch {
      try {
        isExisted && await fs.remove(filename)
      }
      catch (error) {
        logger.error(error)
      }
    }
    return new Set<string>()
  }
}

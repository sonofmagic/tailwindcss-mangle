import fs from 'node:fs'
import path from 'node:path'
import { pkgName } from '@/constants'
import type { CacheOptions, InternalCacheOptions } from '@/types'
import { log } from '@/logger'

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

  mkdir(cacheDirectory: string) {
    const exists = fs.existsSync(cacheDirectory)
    if (!exists) {
      fs.mkdirSync(cacheDirectory, {
        recursive: true,
      })
    }
    return cacheDirectory
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

  write(data: Set<string>) {
    try {
      const { dir, filename } = this.options
      this.mkdir(dir)
      fs.writeFileSync(filename, JSON.stringify([...data], undefined, 2), 'utf8')
      return filename
    }
    catch {
      log('write cache file fail!')
    }
  }

  read() {
    const { filename } = this.options
    try {
      if (fs.existsSync(filename)) {
        const data = fs.readFileSync(filename, 'utf8')
        return new Set<string>(JSON.parse(data))
      }
    }
    catch {
      log(`parse cache content fail! path:${filename}`)
      try {
        fs.unlinkSync(filename)
      }
      catch {
        log(`delete cache file fail! path:${filename}`)
      }
    }
  }
}

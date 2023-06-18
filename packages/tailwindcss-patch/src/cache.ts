import fs from 'node:fs'
import path from 'node:path'
import { pkgName } from './constants'
import type { CacheOptions } from './type'
import { log } from './logger'
export function mkCacheDirectory(cacheDirectory: string) {
  const exists = fs.existsSync(cacheDirectory)
  if (!exists) {
    fs.mkdirSync(cacheDirectory, {
      recursive: true
    })
  }
  return cacheDirectory
}

export function getCacheOptions(options: CacheOptions = {}): Required<CacheOptions> & { filename: string } {
  const cwd = options.cwd ?? process.cwd()
  const dir = options.dir ?? path.resolve(cwd, 'node_modules/.cache', pkgName)
  const file = options.file ?? 'index.json'
  const filename = path.resolve(dir, file)
  return {
    cwd,
    dir,
    file,
    filename,
    strategy: 'merge'
  }
}

export function writeCache(data: Set<string>, options: CacheOptions = {}) {
  try {
    const { dir, filename } = getCacheOptions(options)
    mkCacheDirectory(dir)
    fs.writeFileSync(filename, JSON.stringify([...data], undefined, 2), 'utf8')
    return filename
  } catch {
    log('write cache file fail!')
  }
}

export function readCache(options: CacheOptions = {}) {
  const { filename } = getCacheOptions(options)
  try {
    if (fs.existsSync(filename)) {
      const data = fs.readFileSync(filename, 'utf8')
      return new Set<string>(JSON.parse(data))
    }
  } catch {
    log('parse cache content fail! path:' + filename)
    try {
      fs.unlinkSync(filename)
    } catch {
      log('delete cache file fail! path:' + filename)
    }
  }
}

import fs from 'fs'
import path from 'path'
import { pkgName } from './constants'
import type { CacheOptions } from './type'

export function mkCacheDirectory(cacheDirectory: string) {
  const exists = fs.existsSync(cacheDirectory)
  if (!exists) {
    fs.mkdirSync(cacheDirectory, {
      recursive: true
    })
  }
  return cacheDirectory
}

export function writeCache(data: Set<string>, options: CacheOptions = {}) {
  try {
    const cwd = options.cwd ?? process.cwd()
    const cacheDirectory = options.dir ?? path.resolve(cwd, 'node_modules', '.cache', pkgName)
    const filename = path.resolve(cacheDirectory, options.file ?? 'classSet.json')
    mkCacheDirectory(cacheDirectory)
    fs.writeFileSync(filename, JSON.stringify(Array.from(data), null, 2), 'utf-8')
    return filename
  } catch (error) {
    console.log(error)
  }
}

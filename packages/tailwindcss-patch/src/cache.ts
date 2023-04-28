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

export function getCacheOptions(options: CacheOptions = {}): Required<CacheOptions> & { filename: string } {
  const cwd = options.cwd ?? process.cwd()
  const dir = options.dir ?? path.resolve(cwd, 'node_modules', '.cache', pkgName)
  const file = options.file ?? 'classSet.json'
  const filename = path.resolve(dir, file)
  return {
    cwd,
    dir,
    file,
    filename
  }
}

export function writeCache(data: Set<string>, options: CacheOptions = {}) {
  try {
    const { dir, filename } = getCacheOptions(options)
    mkCacheDirectory(dir)
    fs.writeFileSync(filename, JSON.stringify(Array.from(data), null, 2), 'utf-8')
    return filename
  } catch (error) {
    console.log(error)
  }
}

export function readCache(options: CacheOptions = {}) {
  const { filename } = getCacheOptions(options)
  try {
    const data = fs.readFileSync(filename, 'utf-8')
    return new Set<string>(JSON.parse(data))
  } catch (error) {
    console.log(error)
    fs.unlinkSync(filename)
  }
}

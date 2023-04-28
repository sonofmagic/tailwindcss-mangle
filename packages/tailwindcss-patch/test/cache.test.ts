import { getCacheOptions, mkCacheDirectory, readCache, writeCache } from '../src/cache'
import path from 'path'
import { pkgName } from '../src/constants'
import fs from 'fs'
describe('cache', () => {
  it('getCacheOptions', () => {
    expect(getCacheOptions).toBeDefined()
    expect(getCacheOptions().dir).toBe(path.resolve(process.cwd(), './node_modules/.cache', pkgName))
  })

  it('mkCacheDirectory', () => {
    const dir = path.resolve(__dirname, './fixtures', pkgName)
    expect(mkCacheDirectory(dir)).toBe(dir)
    expect(fs.existsSync(dir)).toBe(true)

    fs.rmdirSync(dir)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('write and read cache default option', () => {
    // const opt = getCacheOptions()
    const opt = {
      dir: path.resolve(__dirname, 'fixtures/cache'),
      file: 'raw-method.json'
    }
    let cache: Set<string> | undefined
    cache = readCache(opt)
    // expect(cache).toBe(undefined)
    writeCache(new Set(['a', 'b', 'c']), opt)
    cache = readCache(opt)
    expect(cache).toBeDefined()
    if (cache) {
      expect(cache.size).toBe(3)
    }
  })

  it('read broken cache', () => {
    // const opt = getCacheOptions()

    const dir = path.resolve(__dirname, './fixtures', pkgName + '-broken')
    const filepath = path.resolve(dir, 'index.json')
    mkCacheDirectory(dir)
    fs.writeFileSync(
      filepath,
      `{
      [ '2',"fuck you",{s:'12}
    }`,
      'utf-8'
    )
    expect(fs.existsSync(filepath)).toBe(true)
    const cache = readCache({
      dir
    })
    expect(cache).toBe(undefined)
    expect(fs.existsSync(filepath)).toBe(false)
  })
})

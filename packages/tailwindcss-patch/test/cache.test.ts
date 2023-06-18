import { getCacheOptions, mkCacheDirectory, readCache, writeCache } from '../src/cache'
import path from 'node:path'
import { pkgName } from '../src/constants'
import fs from 'node:fs'
import { TailwindcssPatcher } from '../src/class'
import { getCss } from './utils'

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
      'utf8'
    )
    expect(fs.existsSync(filepath)).toBe(true)
    const cache = readCache({
      dir
    })
    expect(cache).toBe(undefined)
    expect(fs.existsSync(filepath)).toBe(false)
  })

  it('multiple tw context merge cache', () => {
    const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      cache: {
        dir,
        file: 'merge-multiple-context.json'
      }
    })
    twPatcher.setCache(new Set())
    getCss(['text-[100px]'])
    let ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    let set = twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect(set.has('text-[100px]')).toBe(true)

    // 2 times
    // 不累加
    getCss(['text-[99px]'])
    ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    set = twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(3)
    expect(set.has('text-[99px]')).toBe(true)
    expect(set.has('text-[100px]')).toBe(true)
  })
})

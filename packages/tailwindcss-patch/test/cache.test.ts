import path from 'node:path'
import fs from 'fs-extra'
import { getCss } from './utils'
import { pkgName } from '@/constants'
import { CacheManager, TailwindcssPatcher } from '@/core'
import { getCacheOptions } from '@/core/cache'

describe('cache', () => {
  let cm: CacheManager
  beforeEach(() => {
    cm = new CacheManager()
  })
  it('getCacheOptions', () => {
    expect(cm.getOptions).toBeDefined()
    expect(cm.getOptions().dir).toBe(path.resolve(process.cwd(), './node_modules/.cache', pkgName))
    expect(getCacheOptions(false)).toEqual({
      enable: false,
    })
    expect(getCacheOptions(true)).toEqual({
      enable: true,
    })
  })

  it('mkCacheDirectory', () => {
    const dir = path.resolve(__dirname, './fixtures', pkgName)
    expect(cm.mkdir(dir)).toBe(dir)
    expect(fs.existsSync(dir)).toBe(true)

    fs.rmdirSync(dir)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('write and read cache default option', () => {
    // const opt = getCacheOptions()
    const opt = {
      dir: path.resolve(__dirname, 'fixtures/cache'),
      file: 'raw-method.json',
    }
    cm = new CacheManager(opt)
    let cache: Set<string> | undefined
    cache = cm.read()
    // expect(cache).toBe(undefined)
    cm.write(new Set(['a', 'b', 'c']))
    cache = cm.read()
    expect(cache).toBeDefined()
    if (cache) {
      expect(cache.size).toBe(3)
    }
  })

  it('read broken cache', () => {
    // const opt = getCacheOptions()

    const dir = path.resolve(__dirname, './fixtures', `${pkgName}-broken`)
    const filepath = path.resolve(dir, 'index.json')
    cm.mkdir(dir)
    fs.writeFileSync(
      filepath,
      `{
      [ '2',"fuck you",{s:'12}
    }`,
      'utf8',
    )
    cm = new CacheManager({
      dir,
    })
    expect(fs.existsSync(filepath)).toBe(true)
    const cache = cm.read()
    expect(cache).toBe(undefined)
    expect(fs.existsSync(filepath)).toBe(false)
  })

  it('multiple tw context merge cache', async () => {
    const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      cache: {
        dir,
        file: 'merge-multiple-context.json',
      },
    })
    twPatcher.setCache(new Set())
    await getCss(['text-[100px]'])
    let ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    let set = twPatcher.getClassSet({
      removeUniversalSelector: false,
    })
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect(set.has('text-[100px]')).toBe(true)

    // 2 times
    // 不累加
    await getCss(['text-[99px]'])
    ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    set = twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(3)
    expect(set.has('text-[99px]')).toBe(true)
    expect(set.has('text-[100px]')).toBe(true)
  })
})

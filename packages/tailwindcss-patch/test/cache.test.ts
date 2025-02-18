import { pkgName } from '@/constants'
import { CacheManager, TailwindcssPatcher } from '@/core'
import { getCacheOptions } from '@/core/cache'
import { isCI } from 'ci-info'
import fs from 'fs-extra'
import path from 'pathe'
import { getCss } from './utils'

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
    fs.ensureDirSync(dir)
    expect(fs.existsSync(dir)).toBe(true)

    fs.rmdirSync(dir)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('write and read cache default option', async () => {
    // const opt = getCacheOptions()
    const opt = {
      dir: path.resolve(__dirname, 'fixtures/cache'),
      file: 'raw-method.json',
    }
    cm = new CacheManager(opt)
    let cache: Set<string> | undefined
    cache = await cm.read()
    // expect(cache).toBe(undefined)
    await cm.write(new Set(['a', 'b', 'c']))
    cache = await cm.read()
    expect(cache).toBeDefined()
    if (cache) {
      expect(cache.size).toBe(3)
    }
  })

  it('read broken cache', async () => {
    // const opt = getCacheOptions()

    const dir = path.resolve(__dirname, './fixtures', `${pkgName}-broken`)
    const filepath = path.resolve(dir, 'index.json')

    fs.outputFileSync(
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
    const cache = await cm.read()
    expect(cache).toBe(undefined)
    expect(fs.existsSync(filepath)).toBe(false)
  })

  it.skipIf(isCI)('multiple tw context merge cache', async () => {
    const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      cache: {
        dir,
        file: 'merge-multiple-context.json',
      },
      patch: {
        output: {
          removeUniversalSelector: false,
        },
      },
    })
    await twPatcher.setCache(new Set())
    await getCss(['text-[100px]'])
    let ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    let set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect(set.has('text-[100px]')).toBe(true)

    // 2 times
    // 不累加
    await getCss(['text-[99px]'])
    ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(3)
    expect(set.has('text-[99px]')).toBe(true)
    expect(set.has('text-[100px]')).toBe(true)
  })
})

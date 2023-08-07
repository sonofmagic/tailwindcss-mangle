import { TailwindcssPatcher } from '@/core'
import path from 'node:path'
import { getCss, getTestCase } from './utils'
describe('class', () => {
  it('default', async () => {
    // const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher()
    expect(twPatcher.cacheOptions.enable).toBe(false)
    twPatcher.patch()
    await getCss([getTestCase('hello-world.html')])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = twPatcher.getClassSet({
      removeUniversalSelector: false
    })
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(4)
  })

  it('cache option', async () => {
    const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      cache: {
        dir
      }
    })
    const res = twPatcher.getCache()
    expect(res instanceof Set).toBe(true)
    expect(res?.size).toBe(5)
    const p = twPatcher.setCache(new Set(['*', 'bg-[#123456]', 'font-bold', 'text-3xl', 'underline']))
    expect(p).toBe(path.resolve(dir, 'index.json'))
    twPatcher.patch()
    await getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = twPatcher.getClassSet({
      cacheStrategy: 'overwrite',
      removeUniversalSelector: false
    })
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(5)
  })

  it('multiple time process sources', async () => {
    const twPatcher = new TailwindcssPatcher()
    await getCss(['text-[100px]'])
    let ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    let set = twPatcher.getClassSet({
      removeUniversalSelector: false
    })
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect(set.has('text-[100px]')).toBe(true)

    // 2 times
    // 不累加
    await getCss(['text-[99px]'])
    ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    set = twPatcher.getClassSet({
      removeUniversalSelector: false
    })
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect(set.has('text-[99px]')).toBe(true)

    twPatcher.setCache(new Set())
  })
})

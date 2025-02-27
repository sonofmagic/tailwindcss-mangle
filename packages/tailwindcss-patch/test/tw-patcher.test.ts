import { TailwindcssPatcher } from '@/core'
import path from 'pathe'
import { getCss, getTestCase } from './utils'

describe('class', () => {
  it('default', async () => {
    // const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      patch: {
        output: {
          removeUniversalSelector: false,
        },
      },
    })
    expect(twPatcher.cacheOptions.enable).toBe(false)
    twPatcher.patch()
    await getCss([getTestCase('hello-world.html')])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(4)
  })

  it('cache option', async () => {
    const dir = path.resolve(__dirname, './fixtures/cache')
    const twPatcher = new TailwindcssPatcher({
      cache: {
        dir,
        strategy: 'overwrite',
      },
      patch: {
        output: {
          removeUniversalSelector: false,
        },
      },
    })
    const res = await twPatcher.getCache()
    expect(res instanceof Set).toBe(true)
    expect(res?.size).toBe(5)
    const p = await twPatcher.setCache(new Set(['*', 'bg-[#123456]', 'font-bold', 'text-3xl', 'underline']))
    expect(p).toBe(path.resolve(dir, 'index.json'))
    twPatcher.patch()
    await getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(5)
  })

  it('multiple time process sources', async () => {
    const twPatcher = new TailwindcssPatcher({
      patch: {
        output: {
          removeUniversalSelector: false,
        },
      },
    })
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
    expect(set.size).toBe(2)
    expect(set.has('text-[99px]')).toBe(true)

    twPatcher.setCache(new Set())
  })

  it('wxml process sources', async () => {
    const twPatcher = new TailwindcssPatcher({
      patch: {
        output: {
          removeUniversalSelector: false,
        },
      },
    })
    twPatcher.patch()
    await getCss([`<view class="bg-[#7d7ac2] text-[100px] text-[#123456] {{true?'h-[30px]':'h-[45px]'}}">111</view>`])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(6)
    expect(set.has('text-[100px]')).toBe(true)
    expect(set.has('h-[30px]')).toBe(true)
    expect(set.has('h-[45px]')).toBe(true)
  })

  it('wxml process sources filter', async () => {
    const twPatcher = new TailwindcssPatcher({
      patch: {
        output: {
          removeUniversalSelector: false,
        },
        filter(className) {
          return className.includes('text-[100px]') || className.includes('h-[')
        },
      },
    })
    twPatcher.patch()
    await getCss([`<view class="bg-[#7d7ac2] text-[100px] text-[#123456] {{true?'h-[30px]':'h-[45px]'}}">111</view>`])
    const ctxs = twPatcher.getContexts()
    expect(ctxs.length).toBe(1)
    const set = await twPatcher.getClassSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(3)
    expect(set.has('text-[100px]')).toBe(true)
    expect(set.has('h-[30px]')).toBe(true)
    expect(set.has('h-[45px]')).toBe(true)
    expect(set.has('bg-[#7d7ac2]')).toBe(false)
  })

  it('extract', async () => {
    const twPatcher = new TailwindcssPatcher()
    const filename = await twPatcher.extract()
    console.log(filename)
  })
})

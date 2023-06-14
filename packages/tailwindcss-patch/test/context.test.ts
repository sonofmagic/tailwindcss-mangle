import { getContexts, getClassCacheSet } from '../src'
import { getCss, getTestCase } from './utils'
describe('common usage', () => {
  it('hello-world', () => {
    const result = getCss(getTestCase('hello-world.html'))
    const ctxs = getContexts()
    expect(ctxs.length).toBeTruthy()
    const set = getClassCacheSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(4)
    expect(result).toMatchSnapshot()
  })

  it('hello-world with js', () => {
    const result = getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])
    const ctxs = getContexts()
    expect(ctxs.length).toBeTruthy()
    const set = getClassCacheSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(5)
    expect(result).toMatchSnapshot()
  })

  // https://github.com/sonofmagic/weapp-tailwindcss-webpack-plugin/issues/158
  it("bg-[url('img_src')] lose efficacy", () => {
    getCss([getTestCase('img-url.jsx')])
    const ctxs = getContexts()
    expect(ctxs).toBeTruthy()
    const set = getClassCacheSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(2)
    expect([...set.values()][1]).toBe("bg-[url('https://xxx.webp')]")
    //
  })

  it('trailing slash', () => {
    getCss([getTestCase('trailing-slash.vue')])
    const ctxs = getContexts()
    expect(ctxs).toBeTruthy()
    const set = getClassCacheSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(4)
    expect(set.has('bg-red-500')).toBe(true)
    expect(set.has('bg-red-500/50')).toBe(true)
  })
})

import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import fs from 'fs'
import path from 'path'
import { getContexts, getClassCacheSet } from '../src'

function getTestCase(caseName: string) {
  return fs.readFileSync(path.resolve(__dirname, 'fixtures', caseName), 'utf-8')
}
// @tailwind base;
// @tailwind components;
function getCss(raw: string | string[]) {
  if (typeof raw === 'string') {
    raw = [raw]
  }
  return postcss([
    tailwindcss({
      content: raw.map((x) => {
        return {
          raw: x
        }
      })
    })
  ]).process('@tailwind utilities;').css
}

describe('common usage', () => {
  it('hello-world', () => {
    const result = getCss(getTestCase('hello-world.html'))
    const ctxs = getContexts()
    expect(ctxs).toBeTruthy()
    const set = getClassCacheSet()
    expect(set.size).toBeGreaterThan(0)
    expect(set.size).toBe(4)
    expect(result).toMatchSnapshot()
  })

  it('hello-world with js', () => {
    const result = getCss([getTestCase('hello-world.html'), getTestCase('hello-world.js')])
    const ctxs = getContexts()
    expect(ctxs).toBeTruthy()
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
    expect(Array.from(set.values())[1]).toBe("bg-[url('https://xxx.webp')]")
    //
  })
})

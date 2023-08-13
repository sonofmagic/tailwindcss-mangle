import fs from 'node:fs/promises'
import path from 'node:path'
import MagicString from 'magic-string'
import { Context } from '@/core/context'
const fallbackDir = path.resolve(__dirname, 'fixtures/fallback')

describe('fallback', () => {
  it('ac', async () => {
    const ctx = new Context()
    await ctx.initConfig(fallbackDir)
    const code = await fs.readFile(path.resolve(fallbackDir, 'index.vue'), 'utf8')
    const arr = ctx.search(code)
    const s = new MagicString(code)
    const replaceMap = ctx.getReplaceMap()
    expect(arr).toMatchSnapshot()
    for (const [start, strs] of arr) {
      for (const str of strs) {
        const value = replaceMap.get(str)
        if (value) {
          const res = s.slice(start - str.length + 1, start + 1)
          expect(res).toBe(str)
          console.log(str, value)

          // s.update(start, start + str.length, value)
        }
      }
    }
  })
})

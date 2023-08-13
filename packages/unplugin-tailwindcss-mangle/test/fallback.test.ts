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
          console.log(start, start + str.length, value)
          console.log(s.slice(start, start + str.length))
          // s.update(start, start + str.length, value)
        }
      }
    }
  })
})

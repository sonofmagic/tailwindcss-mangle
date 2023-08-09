import path from 'node:path'
import fs from 'node:fs/promises'
import { preProcessJs } from '@tailwindcss-mangle/core'
import { Context } from '@/core/context'
const fixturesRoot = path.resolve(__dirname, './fixtures')
const tsxRoot = path.resolve(fixturesRoot, './tsx')
const tsRoot = path.resolve(fixturesRoot, './ts')

describe('babel plugin', () => {
  it('tsx app0', async () => {
    const ctx = new Context({
      classListPath: path.resolve(tsxRoot, './.tw-patch/tw-class-list.json')
    })
    await ctx.initConfig()
    const replaceMap = ctx.getReplaceMap()
    const file = path.resolve(tsxRoot, 'app0.tsx')
    const code = await fs.readFile(file, 'utf8')
    const res = preProcessJs({
      code,
      replaceMap,
      addToUsedBy: ctx.addToUsedBy.bind(ctx),
      id: file
    })
    expect(res).toMatchSnapshot()
  })

  it('ts vanilla-0', async () => {
    const ctx = new Context({
      classListPath: path.resolve(tsRoot, './.tw-patch/tw-class-list.json')
    })
    await ctx.initConfig()
    const replaceMap = ctx.getReplaceMap()
    const file = path.resolve(tsRoot, 'vanilla-0.ts')
    const code = await fs.readFile(file, 'utf8')
    const res = preProcessJs({
      code,
      replaceMap,
      addToUsedBy: ctx.addToUsedBy.bind(ctx),
      id: file
    })
    expect(res).toMatchSnapshot()
  })
})

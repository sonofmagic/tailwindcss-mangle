import path from 'node:path'
import fs from 'node:fs/promises'
import { processJs } from '@/core/babel'
import { getOptions } from '@/core/options'
const fixturesRoot = path.resolve(__dirname, './fixtures')
const tsxRoot = path.resolve(fixturesRoot, './tsx')
const tsRoot = path.resolve(fixturesRoot, './ts')

describe('babel plugin', () => {
  it('tsx app0', async () => {
    const { initConfig, getReplaceMap, addToUsedBy } = getOptions({
      classListPath: path.resolve(tsxRoot, './.tw-patch/tw-class-list.json')
    })
    await initConfig()
    const replaceMap = getReplaceMap()
    const file = path.resolve(tsxRoot, 'app0.tsx')
    const code = await fs.readFile(file, 'utf8')
    const res = processJs({
      code,
      replaceMap,
      addToUsedBy,
      id: file
    })
    expect(res).toMatchSnapshot()
  })

  it('ts vanilla-0', async () => {
    const { initConfig, getReplaceMap, addToUsedBy } = getOptions({
      classListPath: path.resolve(tsRoot, './.tw-patch/tw-class-list.json')
    })
    await initConfig()
    const replaceMap = getReplaceMap()
    const file = path.resolve(tsRoot, 'vanilla-0.ts')
    const code = await fs.readFile(file, 'utf8')
    const res = processJs({
      code,
      replaceMap,
      addToUsedBy,
      id: file
    })
    expect(res).toMatchSnapshot()
  })
})

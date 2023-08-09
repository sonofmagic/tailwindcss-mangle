import path from 'node:path'
import fs from 'node:fs/promises'
import { processJs } from '@/core/babel'
import { getOptions } from '@/core/options'

describe('babel plugin', () => {
  it('tsx app0', async () => {
    const { initConfig, getReplaceMap } = getOptions({
      classListPath: path.resolve(__dirname, './fixtures/tsx/.tw-patch/tw-class-list.json')
    })
    await initConfig()
    const replaceMap = getReplaceMap()
    const code = await fs.readFile(path.resolve(__dirname, './fixtures/tsx/app0.tsx'), 'utf8')
    const res = processJs({
      code,
      replaceMap
    })
    expect(res).toMatchSnapshot()
  })
})

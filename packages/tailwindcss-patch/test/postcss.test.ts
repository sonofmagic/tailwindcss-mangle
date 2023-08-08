import path from 'node:path'
import { appRoot } from './utils'
import { processTailwindcss } from '@/core/postcss'
import { TailwindcssPatcher } from '@/core/tw-patcher'

describe('postcss', () => {
  it('getCss 0.common', async () => {
    const p = path.resolve(appRoot, '0.common')
    const twPatcher = new TailwindcssPatcher()
    const res = await processTailwindcss({
      cwd: p
    })
    expect(res.css).toMatchSnapshot()
    const res0 = twPatcher.getContexts()
    expect(res0.length).toBe(1)
    const set = twPatcher.getClassSet({
      removeUniversalSelector: false
    })
    expect(set.size).toBe(4)
  })
})

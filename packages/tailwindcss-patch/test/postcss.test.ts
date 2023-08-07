import { getCss } from '@/core/postcss'
import path from 'node:path'
import { TailwindcssPatcher } from '@/core'
const appRoot = path.resolve(__dirname, './fixtures/apps')
describe('postcss', () => {
  it('getCss 0.common', async () => {
    const p = path.resolve(appRoot, '0.common')
    const twPatcher = new TailwindcssPatcher()
    const res = await getCss(undefined, p)
    expect(res.css).toMatchSnapshot()
    const res0 = twPatcher.getContexts()
    expect(res0.length).toBe(1)
    const set = twPatcher.getClassSet()
    expect(set.size).toBe(4)
  })
})

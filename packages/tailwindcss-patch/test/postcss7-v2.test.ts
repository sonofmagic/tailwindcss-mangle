import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from '@/core/patches/exportContext/postcss-v2'
import { getTestCase } from './utils'

describe('postcss7-compat', () => {
  it('processTailwindFeatures patch', async () => {
    const code = getTestCase('postcss7-compat/lib/jit/processTailwindFeatures.js')
    const r = inspectProcessTailwindFeaturesReturnContext(code)

    expect(r.code).toMatchSnapshot()
    expect(r.hasPatched).toBe(false)
  })

  it('jit plugins patch', async () => {
    const code = getTestCase('postcss7-compat/lib/jit/index.js')
    const r = inspectPostcssPlugin(code)

    expect(r.code).toMatchSnapshot()
    expect(r.hasPatched).toBe(false)
  })

  it('jit plugins patch case 0', async () => {
    const code = getTestCase('postcss7-compat/lib/jit/index.js')
    let r = inspectPostcssPlugin(code)
    expect(r.hasPatched).toBe(false)
    r = inspectPostcssPlugin(r.code)
    expect(r.code).toMatchSnapshot()
    expect(r.hasPatched).toBe(true)
  })
})

// const XXXEnum = {
//   A: 1,
//   B: 2,
//   C: 'xxx'
// } as const

// type EnumType<T> = (T)[keyof T]

// function xx(x: EnumType<typeof XXXEnum>) {

// }

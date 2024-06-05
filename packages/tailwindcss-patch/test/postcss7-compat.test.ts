import { getTestCase } from './utils'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from '@/core/inspector-postcss7-compat'

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
})

// const XXXEnum = {
//   A: 1,
//   B: 2,
//   C: 'xxx'
// } as const

// type EnumType<T> = (T)[keyof T]

// function xx(x: EnumType<typeof XXXEnum>) {

// }

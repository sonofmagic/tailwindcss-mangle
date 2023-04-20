// import { escapeStringRegexp } from '../src/utils'
import { makeRegex } from '../src/js/index'
describe('regex', () => {
  it('z-10 regex', () => {
    const testCase = 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'
    const regex = makeRegex('z-10')
    const arr = Array.from(testCase.matchAll(regex))
    expect(arr.length).toBe(1)
    expect(arr).toMatchSnapshot()
  })
})

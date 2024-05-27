import { makeRegex } from '@/regex'

describe('regex', () => {
  it('z-10 regex', () => {
    const testCase = 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'
    const regex = makeRegex('z-10')
    const arr = [...testCase.matchAll(regex)]
    expect(arr.length).toBe(1)
    expect(arr).toMatchSnapshot()
  })

  it('trailing slash should exact match case 0', () => {
    const testCase = 'bg-red-500 bg-red-500/50'
    const regex = makeRegex('bg-red-500', {
      exact: false,
    })
    const arr = [...testCase.matchAll(regex)]
    expect(arr.length).toBe(2)
    expect(arr).toMatchSnapshot()
  })

  it('trailing slash should exact match case 1', () => {
    const testCase = 'bg-red-500 bg-red-500/50'
    const regex = makeRegex('bg-red-500')
    const arr = [...testCase.matchAll(regex)]
    expect(arr.length).toBe(1)
    expect(arr).toMatchSnapshot()
  })

  it('trailing slash should exact match case 2', () => {
    const testCase = 's bg-red-500 bg-red-500/50 bg-red-500'
    const regex = makeRegex('bg-red-500')
    const arr = [...testCase.matchAll(regex)]
    expect(arr.length).toBe(2)
    expect(arr).toMatchSnapshot()
  })
})

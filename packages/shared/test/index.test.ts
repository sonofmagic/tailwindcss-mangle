import * as shared from '@/index'

describe('package entrypoint', () => {
  it('exposes key helpers', () => {
    expect(typeof shared.ClassGenerator).toBe('function')
    expect(typeof shared.defu).toBe('function')
    expect(typeof shared.defaultMangleClassFilter).toBe('function')
  })
})

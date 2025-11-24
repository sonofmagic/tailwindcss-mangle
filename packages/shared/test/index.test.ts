describe('package entrypoint', () => {
  it('exposes key helpers', async () => {
    const shared = await import('@/index')

    expect(typeof shared.ClassGenerator).toBe('function')
    expect(typeof shared.defu).toBe('function')
    expect(typeof shared.defaultMangleClassFilter).toBe('function')
  })
})

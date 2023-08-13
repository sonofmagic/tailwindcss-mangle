function createContext() {
  let a = 1
  function inc() {
    a++
  }
  return {
    a,
    inc
  }
}

describe('contxt', () => {
  it('contxt change', () => {
    const ctx = createContext()
    expect(ctx.a).toBe(1)
    ctx.inc()
    expect(ctx.a).toBe(1)
  })
})

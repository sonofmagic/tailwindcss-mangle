import { describe, expect, it, vi } from 'vitest'

describe('loadC12 caching', () => {
  it('imports c12 once and reuses the cached promise across calls', async () => {
    const importCounter = vi.fn()
    const loadConfig = vi.fn()
      .mockResolvedValueOnce({ config: { first: true } })
      .mockResolvedValueOnce({ config: { second: true } })

    vi.doMock('c12', () => {
      importCounter()
      return {
        loadConfig,
        createDefineConfig: () => (value: unknown) => value,
      }
    })

    vi.resetModules()
    const { getConfig } = await import('../src/config')

    const first = await getConfig('/tmp/first')
    const second = await getConfig('/tmp/second')

    expect(importCounter).toHaveBeenCalledTimes(1)
    expect(loadConfig).toHaveBeenCalledTimes(2)
    expect(loadConfig).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: '/tmp/second' }))
    expect(first.config).toEqual({ first: true })
    expect(second.config).toEqual({ second: true })

    vi.resetModules()
    vi.doUnmock('c12')
  })
})

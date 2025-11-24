import { describe, expect, it, vi } from 'vitest'

describe('getConfig caching', () => {
  it('imports c12 once and reuses the cached promise', async () => {
    const importCalls = vi.fn()
    const loadConfig = vi.fn().mockResolvedValue({ config: { ok: true } })

    vi.doMock('c12', () => {
      importCalls()
      return {
        loadConfig,
        createDefineConfig: () => (value: unknown) => value,
      }
    })

    vi.resetModules()
    const { getConfig } = await import('../src/config')

    await getConfig('/tmp/one')
    await getConfig('/tmp/two')

    expect(importCalls).toHaveBeenCalledTimes(1)
    expect(loadConfig).toHaveBeenCalledTimes(2)

    vi.doUnmock('c12')
    vi.resetModules()
  })
})

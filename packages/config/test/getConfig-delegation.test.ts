import { describe, expect, it, vi } from 'vitest'

describe('getConfig delegation', () => {
  it('passes cwd and defaults to c12.loadConfig', async () => {
    const loadConfig = vi.fn().mockResolvedValue({ config: {} })
    const getDefaultUserConfig = vi.fn().mockReturnValue({ patch: {}, mangle: {} })
    const constants = await vi.importActual<typeof import('../src/constants')>('../src/constants')

    vi.doMock('c12', () => ({
      loadConfig,
      createDefineConfig: () => (value: unknown) => value,
    }))
    vi.doMock('../src/defaults', () => ({
      getDefaultUserConfig,
    }))

    vi.resetModules()
    const { getConfig } = await import('../src/config')
    await getConfig('custom-cwd')

    expect(loadConfig).toHaveBeenCalledWith(expect.objectContaining({
      name: constants.CONFIG_NAME,
      cwd: 'custom-cwd',
    }))
    expect(getDefaultUserConfig).toHaveBeenCalledTimes(1)

    vi.resetModules()
    vi.doUnmock('c12')
    vi.doUnmock('../src/defaults')
  })
})

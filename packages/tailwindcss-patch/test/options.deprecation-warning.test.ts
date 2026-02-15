import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unmock('../src/logger')
})

describe('normalizeOptions deprecation warning', () => {
  it('warns only once when deprecated top-level options are used', async () => {
    const warn = vi.fn()
    vi.doMock('../src/logger', () => ({
      default: {
        warn,
      },
    }))

    const { normalizeOptions } = await import('../src/options/normalize')
    normalizeOptions({
      cwd: '/tmp/project',
      output: {
        file: '.tw-patch/classes.json',
      },
    })
    normalizeOptions({
      tailwind: {
        version: 4,
      },
    })

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('deprecated')
    expect(warn.mock.calls[0]?.[0]).toContain('cwd -> projectRoot')
    expect(warn.mock.calls[0]?.[0]).toContain('output -> extract')
  })

  it('does not warn when only modern options are used', async () => {
    const warn = vi.fn()
    vi.doMock('../src/logger', () => ({
      default: {
        warn,
      },
    }))

    const { normalizeOptions } = await import('../src/options/normalize')
    normalizeOptions({
      projectRoot: '/tmp/project',
      apply: {
        overwrite: false,
      },
      extract: {
        file: '.tw-patch/classes.json',
      },
      tailwindcss: {
        version: 4,
      },
    })

    expect(warn).not.toHaveBeenCalled()
  })
})

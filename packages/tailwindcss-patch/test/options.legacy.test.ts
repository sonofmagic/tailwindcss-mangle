import { describe, expect, it } from 'vitest'
import { fromUnifiedConfig } from '@/options/legacy'

describe('fromUnifiedConfig', () => {
  it('maps modern unified registry options to patcher options', () => {
    const converted = fromUnifiedConfig({
      projectRoot: '/tmp/new-root',
      extract: {
        write: false,
        file: 'new.json',
        format: 'lines',
        pretty: 4,
        removeUniversalSelector: true,
      },
      apply: {
        overwrite: false,
        exposeContext: {
          refProperty: 'runtimeCtx',
        },
      },
      cache: {
        enabled: true,
        dir: '.cache',
      },
      tailwindcss: {
        packageName: 'tailwindcss-modern',
        version: 4,
        v4: {
          cssEntries: ['src/new.css'],
        },
      },
    })

    expect(converted).toEqual({
      projectRoot: '/tmp/new-root',
      extract: {
        write: false,
        file: 'new.json',
        format: 'lines',
        pretty: 4,
        removeUniversalSelector: true,
      },
      apply: {
        overwrite: false,
        exposeContext: {
          refProperty: 'runtimeCtx',
        },
      },
      cache: {
        enabled: true,
        dir: '.cache',
      },
      tailwindcss: {
        packageName: 'tailwindcss-modern',
        version: 4,
        v4: {
          cssEntries: ['src/new.css'],
        },
      },
    })
  })

  it('rejects deprecated registry aliases', () => {
    expect(() => fromUnifiedConfig({
      output: {
        file: 'legacy.json',
      },
    } as any)).toThrow('Legacy registry fields are no longer supported')

    expect(() => fromUnifiedConfig({
      tailwindcss: {
        version: 4,
        next: {
          cssEntries: ['src/legacy.css'],
        },
      },
    } as any)).toThrow('Legacy "registry.tailwindcss" fields are no longer supported')
  })
})

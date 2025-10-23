import { describe, expect, it } from 'vitest'
import { fromLegacyOptions } from '@/options/legacy'

describe('fromLegacyOptions', () => {
  it('converts legacy patcher options to the new format', () => {
    const converted = fromLegacyOptions({
      cache: {
        dir: '.cache',
        file: 'classes.json',
      },
      patch: {
        packageName: 'tailwindcss',
        overwrite: false,
        output: {
          filename: 'classes.json',
          loose: true,
          removeUniversalSelector: false,
        },
        applyPatches: {
          exportContext: true,
          extendLengthUnits: {
            units: ['rpx'],
          },
        },
        tailwindcss: {
          version: 3,
          v3: {
            cwd: './fixtures/apps/basic',
            config: './fixtures/apps/basic/tailwind.config.js',
          },
        },
      },
    })

    expect(converted.output?.file).toBe('classes.json')
    expect(converted.output?.format).toBeUndefined()
    expect(converted.output?.removeUniversalSelector).toBe(false)
    expect(converted.cache).toMatchObject({
      enabled: true,
      dir: '.cache',
    })
    expect(converted.features?.extendLengthUnits).toMatchObject({
      units: ['rpx'],
    })
    expect(converted.tailwind?.version).toBe(3)
    expect(converted.tailwind?.v3?.cwd).toBe('./fixtures/apps/basic')
  })
})

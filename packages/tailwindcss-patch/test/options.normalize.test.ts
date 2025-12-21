import { describe, expect, it } from 'vitest'
import { normalizeOptions } from '@/options/normalize'

describe('normalizeOptions', () => {
  it('provides sensible defaults', () => {
    const normalized = normalizeOptions()

    expect(normalized.projectRoot).toBe(process.cwd())
    expect(normalized.output.file).toBe('.tw-patch/tw-class-list.json')
    expect(normalized.output.removeUniversalSelector).toBe(true)
    expect(normalized.cache.enabled).toBe(false)
    expect(normalized.cache.driver).toBe('file')
    expect(normalized.features.exposeContext.enabled).toBe(true)
    expect(normalized.features.extendLengthUnits).toBeNull()
  })

  it('honours overrides for cache, features, and output', () => {
    const normalized = normalizeOptions({
      overwrite: false,
      output: {
        file: 'classes.json',
        format: 'lines',
        pretty: false,
        removeUniversalSelector: false,
      },
      cache: {
        enabled: true,
        dir: './.cache/custom',
        file: 'classes.json',
        strategy: 'overwrite',
        driver: 'memory',
      },
      features: {
        exposeContext: { refProperty: 'runtimeContexts' },
        extendLengthUnits: {
          units: ['rpx', 'vh'],
        },
      },
    })

    expect(normalized.overwrite).toBe(false)
    expect(normalized.output.format).toBe('lines')
    expect(normalized.output.removeUniversalSelector).toBe(false)
    expect(normalized.cache.enabled).toBe(true)
    expect(normalized.cache.strategy).toBe('overwrite')
    expect(normalized.cache.driver).toBe('memory')
    expect(normalized.features.exposeContext.refProperty).toBe('runtimeContexts')
    expect(normalized.features.extendLengthUnits?.units).toContain('vh')
  })
})

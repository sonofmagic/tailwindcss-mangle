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
      apply: {
        overwrite: false,
        exposeContext: { refProperty: 'runtimeContexts' },
        extendLengthUnits: {
          units: ['rpx', 'vh'],
        },
      },
      extract: {
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

  it('keeps deprecated fields compatible while preferring the new fields', () => {
    const normalized = normalizeOptions({
      cwd: '/tmp/legacy-cwd',
      projectRoot: '/tmp/new-project-root',
      overwrite: true,
      output: {
        file: 'legacy.json',
      },
      features: {
        exposeContext: false,
      },
      tailwind: {
        packageName: 'tailwindcss-legacy',
      },
      apply: {
        overwrite: false,
        exposeContext: { refProperty: 'newContextRef' },
      },
      extract: {
        file: 'new.json',
      },
      tailwindcss: {
        packageName: 'tailwindcss-new',
      },
    })

    expect(normalized.projectRoot).toBe('/tmp/new-project-root')
    expect(normalized.overwrite).toBe(false)
    expect(normalized.output.file).toBe('new.json')
    expect(normalized.features.exposeContext).toEqual({
      enabled: true,
      refProperty: 'newContextRef',
    })
    expect(normalized.tailwind.packageName).toBe('tailwindcss-new')
  })
})

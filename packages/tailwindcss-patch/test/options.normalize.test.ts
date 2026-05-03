import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { normalizeOptions } from '@/options/normalize'

describe('normalizeOptions', () => {
  it('provides sensible defaults', () => {
    const normalized = normalizeOptions({
      tailwindcss: {
        version: 3,
      },
    })

    expect(path.normalize(normalized.projectRoot)).toBe(path.normalize(process.cwd()))
    expect(normalized.output.file).toBe('.tw-patch/tw-class-list.json')
    expect(normalized.output.removeUniversalSelector).toBe(true)
    expect(normalized.cache.enabled).toBe(false)
    expect(normalized.cache.driver).toBe('file')
    expect(normalized.features.exposeContext.enabled).toBe(true)
    expect(normalized.features.extendLengthUnits).toBeNull()
    expect(normalized.tailwind.resolve).toBeUndefined()
  })

  it('resolves Tailwind packages from the configured project root by default', () => {
    const normalized = normalizeOptions({
      projectRoot: '/tmp/app',
      tailwindcss: {
        version: 3,
      },
    })

    expect(normalized.tailwind.cwd).toBe('/tmp/app')
    expect(normalized.tailwind.resolve).toEqual({ paths: ['/tmp/app'] })
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
      tailwindcss: {
        version: 4,
        resolve: {
          paths: ['/tmp/custom'],
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
    expect(normalized.tailwind.resolve).toEqual({ paths: ['/tmp/custom'] })
  })

  it('requires modern options only', () => {
    expect(() => normalizeOptions({
      cwd: '/tmp/legacy-cwd',
      tailwindcss: {
        version: 3,
      },
    } as any)).toThrow('Legacy TailwindcssPatcher options are no longer supported')
  })
})

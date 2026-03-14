import { describe, expect, it } from 'vitest'
import { normalizeOptions } from '@/options/normalize'

describe('normalizeOptions modern-only validation', () => {
  it('rejects deprecated top-level option aliases', () => {
    expect(() => normalizeOptions({
      cwd: '/tmp/project',
    } as any)).toThrow('Legacy TailwindcssPatcher options are no longer supported')

    expect(() => normalizeOptions({
      tailwind: {
        version: 4,
      },
    } as any)).toThrow('tailwind -> tailwindcss')
  })

  it('allows tailwindcss.version to be inferred later', () => {
    const normalized = normalizeOptions({
      projectRoot: '/tmp/project',
      tailwindcss: {} as any,
    })

    expect(normalized.tailwind.packageName).toBe('tailwindcss')
    expect(normalized.tailwind.versionHint).toBeUndefined()
  })

  it('accepts modern options only', () => {
    const normalized = normalizeOptions({
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

    expect(normalized.projectRoot.endsWith('/tmp/project')).toBe(true)
    expect(normalized.tailwind.versionHint).toBe(4)
    expect(normalized.overwrite).toBe(false)
  })
})

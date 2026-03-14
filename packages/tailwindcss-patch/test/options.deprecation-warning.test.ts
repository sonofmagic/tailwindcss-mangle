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

  it('requires tailwindcss.version', () => {
    expect(() => normalizeOptions({
      projectRoot: '/tmp/project',
      tailwindcss: {} as any,
    })).toThrow('Missing required "tailwindcss.version"')
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

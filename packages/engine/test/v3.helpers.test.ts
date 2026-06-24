import { describe, expect, it } from 'vitest'
import {
  collectDependencyMessages,
  getDefaultExport,
  sortCandidates,
} from '@/v3/style-generator'

describe('Tailwind v3 helper internals', () => {
  it('normalizes default exports and plain CommonJS values', () => {
    const value = { run: () => 'ok' }

    expect(getDefaultExport({ default: value })).toBe(value)
    expect(getDefaultExport(value)).toBe(value)
  })

  it('sorts candidates with stable equality handling', () => {
    expect(sortCandidates(['b', 'a', 'a'])).toEqual(['a', 'a', 'b'])
  })

  it('collects dependency messages from Tailwind v3 processing output', () => {
    expect(collectDependencyMessages({
      css: '',
      messages: [
        { type: 'dependency', file: '/project/tailwind.config.js' },
        { type: 'dependency', file: '/project/tailwind.config.js' },
        { type: 'dependency', file: 123 },
        { type: 'dir-dependency', dir: '/project/src' },
      ],
    })).toEqual(['/project/tailwind.config.js'])
  })
})

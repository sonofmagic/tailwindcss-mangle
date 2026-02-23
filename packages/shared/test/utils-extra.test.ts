import { describe, expect, it } from 'vitest'
import {
  acceptChars,
  defaultMangleClassFilter,
  defu,
  defuOverrideArray,
  groupBy,
  isMap,
  isRegexp,
  preserveClassNames,
  regExpTest,
  stripEscapeSequence,
} from '@/utils'

describe('shared utils', () => {
  it('defuOverrideArray replaces arrays instead of merging', () => {
    const defaults = { arr: ['a'], nested: { items: ['x'] } }
    const overrides = { arr: ['b'], nested: { items: ['y'] } }
    const merged = defuOverrideArray(overrides, defaults)

    expect(merged.arr).toEqual(['b'])
    expect(merged.nested.items).toEqual(['y'])
  })

  it('supports defu helper passthrough', () => {
    const obj = defu({ a: 1 }, { a: undefined, b: 2 })
    expect(obj).toEqual({ a: 1, b: 2 })
  })

  it('filters reserved class names and accepts hyphen/colon classes', () => {
    for (const preserved of preserveClassNames) {
      expect(defaultMangleClassFilter(preserved)).toBe(false)
    }

    expect(defaultMangleClassFilter('bg-[#123]')).toBe(true)
    expect(defaultMangleClassFilter('container')).toBe(false)
    expect(defaultMangleClassFilter('md:hover:text-red-500')).toBe(true)
  })

  it('groups items and validates input types', () => {
    const grouped = groupBy(['a', 'b', 'aa'], value => String(value.length))
    expect(grouped).toEqual({
      1: ['a', 'b'],
      2: ['aa'],
    })

    expect(() => groupBy('nope' as unknown as string[], () => 'x')).toThrowError(TypeError)
    expect(() => groupBy([], 'nope' as unknown as (value: string) => string)).toThrowError(TypeError)
  })

  it('strips escape sequences and detects RegExp/Map types', () => {
    expect(stripEscapeSequence('text\\[50\\]')).toBe('text[50]')
    expect(isRegexp(/foo/)).toBe(true)
    expect(isRegexp('foo')).toBe(false)

    expect(isMap(new Map())).toBe(true)
    expect(isMap({})).toBe(false)
  })

  it('tests arrays of strings or regexps and resets lastIndex', () => {
    const regex = /foo/g
    expect(regExpTest(['foo', regex], 'foo')).toBe(true)
    expect(regExpTest([regex], 'foo')).toBe(true)
    expect(regExpTest(['bar'], 'foo')).toBe(false)

    expect(() => regExpTest('invalid' as unknown as (string | RegExp)[], 'foo')).toThrowError(TypeError)
  })

  it('returns false for empty or non-regexp entries', () => {
    expect(regExpTest([], 'foo')).toBe(false)
    expect(regExpTest([123 as unknown as RegExp], 'foo')).toBe(false)
  })

  it('exposes alphabet characters', () => {
    expect(acceptChars.length).toBe(26)
    expect(acceptChars[0]).toBe('a')
    expect(acceptChars[25]).toBe('z')
  })
})

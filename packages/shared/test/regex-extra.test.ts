import { escapeStringRegexp, makeRegex } from '@/regex'

describe('regex helpers', () => {
  it('escapes all special characters including hyphen', () => {
    expect(escapeStringRegexp('a-b?c')).toBe('a\\x2db\\?c')
  })

  it('throws when provided with non-string input', () => {
    expect(() => escapeStringRegexp(123 as unknown as string)).toThrowError(TypeError)
  })

  it('builds regexes with optional exact matching', () => {
    const exact = makeRegex('foo').source
    const loose = makeRegex('foo', { exact: false }).source

    expect(exact).toContain('(?=$|[\\s"])')
    expect(loose).not.toContain('(?=$|[\\s"])')
  })
})

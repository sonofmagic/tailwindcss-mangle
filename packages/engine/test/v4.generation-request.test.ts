import type { TailwindV4ResolvedSource } from '@/v4/types'
import { describe, expect, it } from 'vitest'
import { stripCompiledSourceEntries } from '@/v4/generation-request'

function source(css: string): TailwindV4ResolvedSource {
  return { css, projectRoot: '.', base: '.', baseFallbacks: [], dependencies: [] }
}

describe('compiled source entry stripping', () => {
  it('removes source directives and nested import modifiers without interpreting strings', () => {
    const input = source([
      '@import "source(fake)" source(fn("./src")) layer(base);',
      '@source "./components";',
      '.x { content: "@source unchanged;"; @source inline("p-4"); color: red; }',
    ].join('\n'))
    const result = stripCompiledSourceEntries(input)
    expect(result.css).toBe([
      '@import "source(fake)" layer(base);',
      '.x { content: "@source unchanged;"; color: red; }',
    ].join('\n'))
    expect(stripCompiledSourceEntries(source('@import "x" supports(display: grid) source("src");')).css)
      .toBe('@import "x" supports(display: grid);')
    expect(result.dependencies).toBe(input.dependencies)
    expect(input.css).toContain('@source "./components";')
  })

  it('preserves object identity for unchanged and invalid stylesheets', () => {
    for (const css of [
      '.x { color: red; }',
      '/* @source "./src"; */ .x { content: "source(fake)"; }',
      '@import "source(fake)";',
      '@source "./src"; .x {',
      '@source "./src"; /* unfinished',
      '@import "tailwindcss" source(fn("./src");',
      '@source "unfinished',
    ]) {
      const input = source(css)
      expect(stripCompiledSourceEntries(input)).toBe(input)
    }
  })

  it('keeps valid neighboring rules when the first source directive is removed', () => {
    expect(stripCompiledSourceEntries(source('@source "./src";\n.x {}')).css).toBe('.x {}')
    expect(stripCompiledSourceEntries(source('  @source "./src";\n.x {}')).css).toBe('  .x {}')
    expect(stripCompiledSourceEntries(source('  @source "./a";\n@source "./b";\n')).css).toBe('\n')
    expect(stripCompiledSourceEntries(source('@source "./a";\n@source "./b";\n.x {}')).css).toBe('.x {}')
    expect(stripCompiledSourceEntries(source('/* header */\n@source "./src";\n.x {}')).css).toBe('/* header */\n.x {}')
  })
})

import MagicString from 'magic-string'
import { Context, cssHandler, htmlHandler, jsHandler } from '@/index'

describe('native context compatibility', () => {
  it('synchronizes public Map mutations and replacement of the Map', async () => {
    const ctx = new Context()
    ctx.replaceMap.set('bg-red-500', 'red')
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.red{}')
    ctx.replaceMap.set('bg-red-500', 'blue')
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.blue{}')
    ctx.replaceMap.delete('bg-red-500')
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.bg-red-500{}')
    ctx.replaceMap = new Map([['bg-red-500', 'green']])
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.green{}')
    ctx.replaceMap.set('bg-red-500', 'purple')
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.purple{}')
    ctx.replaceMap.clear()
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toBe('.bg-red-500{}')
  })

  it('generates only encountered names, preserving order and mutable generator entries', () => {
    const ctx = new Context()
    const calls: string[] = []
    ctx.classGenerator.opts.customGenerate = (original) => {
      calls.push(original)
      return `x-${calls.length}`
    }
    ctx.replaceMap.set('unused-class', 'ignored')
    ctx.replaceMap.set('second-class', 'ignored')
    ctx.replaceMap.set('first-class', 'ignored')
    expect(jsHandler('const x = "first-class second-class"', { ctx }).code).toBe('const x = "x-1 x-2"')
    expect(calls).toEqual(['first-class', 'second-class'])
    ctx.classGenerator.newClassMap['first-class']!.name = 'updated'
    expect(htmlHandler('<div class="first-class"></div>', { ctx }).code).toBe('<div class="updated"></div>')
  })

  it('keeps edits in UTF-16 coordinates and composes with existing MagicString edits', () => {
    const ctx = new Context()
    ctx.replaceMap.set('bg-red-500', 'unused')
    const source = 'const emoji = "😀"; const x = "bg-red-500"'
    const ms = new MagicString(source)
    ms.update(6, 11, 'label')
    const result = jsHandler(ms, { ctx, id: 'unicode.ts' })
    expect(result.code).toBe('const label = "😀"; const x = "tw-a"')
    expect(result.map).toEqual(ms.generateMap())
    expect(ctx.classGenerator.newClassMap['bg-red-500']?.usedBy).toEqual(new Set(['unicode.ts']))
  })

  it('shares preservation side effects with subsequent CSS transforms', async () => {
    const ctx = new Context()
    await ctx.initConfig({ classList: ['bg-red-500'], transformerOptions: { registry: { mapping: false } } })
    jsHandler('const x = twIgnore`bg-red-500`', { ctx })
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toContain('.bg-red-500{}')
    expect((await cssHandler('.bg-red-500{}', { ctx })).code).toContain('.tw-a{}')
  })
})

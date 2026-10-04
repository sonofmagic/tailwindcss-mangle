import { cssHandler } from '@/css'
import { Context } from '@/ctx'
import { htmlHandler } from '@/html'
import { jsHandler } from '@/js'
import { makeRegex } from '@/shared'

describe('native callback boundary', () => {
  function context(...classes: string[]) {
    const ctx = new Context()
    for (const original of classes) {
      ctx.replaceMap.set(original, 'placeholder')
    }
    return ctx
  }

  it('runs preserve call entry before generating descendant names', () => {
    const ctx = context('p-1')
    ctx.preserveFunctionSet.add('cx')
    ctx.classGenerator.opts.customGenerate = original => ctx.isPreserveClass(original) ? 'preserved' : 'unpreserved'
    expect(jsHandler('cx("p-1")', { ctx }).code).toBe('cx("preserved")')
  })

  it('does not expose future twIgnore preservation to earlier callbacks', () => {
    const ctx = context('p-1', 'p-2')
    ctx.classGenerator.opts.customGenerate = () => ctx.isPreserveClass('unknown') ? 'after' : 'before'
    const source = 'const a="p-1"; twIgnore`unknown`; const b="p-2"'
    expect(jsHandler(source, { ctx }).code).toBe('const a="before"; twIgnore`unknown`; const b="after"')
  })

  it.each(['js', 'html'] as const)('exposes usedBy immediately to the next %s callback', (kind) => {
    const ctx = context('p-1', 'p-2')
    ctx.classGenerator.opts.customGenerate = original => original === 'p-1'
      ? 'first'
      : ctx.classGenerator.newClassMap['p-1']!.usedBy.has('file.js') ? 'used-first' : 'not-used-first'
    const source = kind === 'js' ? 'const a="p-1 p-2"' : '<div class="p-1 p-2">'
    const handler = kind === 'js' ? jsHandler : htmlHandler
    expect(handler(source, { ctx, id: 'file.js' }).code).toBe(source.replace('p-1 p-2', 'first used-first'))
  })

  it.each(['js', 'html'] as const)('observes callback additions to later %s candidates', (kind) => {
    const ctx = context('p-1')
    ctx.classGenerator.opts.customGenerate = (original) => {
      ctx.replaceMap.set('p-2', 'placeholder')
      return original === 'p-1' ? 'first' : 'second'
    }
    const source = kind === 'js' ? 'const a="p-1 p-2"' : '<div class="p-1 p-2">'
    const handler = kind === 'js' ? jsHandler : htmlHandler
    expect(handler(source, { ctx }).code).toBe(source.replace('p-1 p-2', 'first second'))
  })

  it('observes mapping deletion and later preserve function changes during callbacks', () => {
    const ctx = context('p-1', 'p-2', 'p-3')
    ctx.classGenerator.opts.customGenerate = (original) => {
      if (original === 'p-1') {
        ctx.replaceMap.delete('p-2')
        ctx.preserveFunctionSet.add('cx')
      }
      return ctx.isPreserveClass(original) ? 'preserved' : 'first'
    }
    expect(jsHandler('const a="p-1 p-2";cx("p-3")', { ctx }).code).toBe('const a="first p-2";cx("preserved")')
  })

  it('keeps sequential replacement and repeated candidate callback order', () => {
    const ctx = context('p-1', 'p-2')
    ctx.classGenerator.opts.customGenerate = original => original === 'p-1' ? 'p-2' : 'second'
    expect(jsHandler('const a="p-1 p-2 p-1"', { ctx }).code).toBe('const a="second second second"')
  })

  it('updates native CSS snapshots after prototype Map mutations', async () => {
    const ctx = context('p-1')
    ctx.replaceMap.set('p-1', 'first')
    expect((await cssHandler('.p-1{}', { ctx })).code).toBe('.first{}')
    Map.prototype.set.call(ctx.replaceMap, 'p-1', 'second')
    expect((await cssHandler('.p-1{}', { ctx })).code).toBe('.second{}')
    Map.prototype.delete.call(ctx.replaceMap, 'p-1')
    expect((await cssHandler('.p-1{}', { ctx })).code).toBe('.p-1{}')
  })

  it('keeps ordinary Map receiver semantics and public class-record changes', () => {
    const ctx = context('p-1')
    const other = new Map<string, string>()
    ctx.replaceMap.set.call(other, 'p-2', 'other')
    expect(other.get('p-2')).toBe('other')
    expect(ctx.replaceMap.has('p-2')).toBe(false)
    expect(jsHandler('const a="p-1"', { ctx }).code).toBe('const a="tw-a"')
    ctx.classGenerator.newClassMap['p-1']!.name = 'changed'
    expect(jsHandler('const a="p-1"', { ctx }).code).toBe('const a="changed"')
  })

  it.each(['$&', '$$', '$`', '$\'', '$1', '$<name>', 'prefix-$&-$$'])('preserves replacement string semantics for %s', (replacement) => {
    for (const preallocated of [false, true]) {
      const ctx = context('p-1')
      ctx.classGenerator.opts.customGenerate = () => replacement
      if (preallocated) {
        ctx.classGenerator.generateClassName('p-1')
      }
      const raw = 'before p-1 after'
      const expected = raw.replace(makeRegex('p-1'), replacement)
      expect(jsHandler(`const a=${JSON.stringify(raw)}`, { ctx }).code).toBe(`const a=${JSON.stringify(expected).replaceAll('\'', '\\\'')}`)
      expect(htmlHandler(`<div class="${raw}">`, { ctx }).code).toBe(`<div class="${expected.replaceAll('&', '&amp;')}">`)
    }
  })
})

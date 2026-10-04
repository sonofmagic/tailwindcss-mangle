import { splitCode } from '@tailwindcss-mangle/shared'
import MagicString from 'magic-string'
import { Context } from '@/ctx'
import { htmlHandler } from '@/html'
import { getTestCase } from './utils'

describe('html handler', () => {
  // let classGenerator: ClassGenerator
  let ctx: Context
  beforeEach(() => {
    // classGenerator = new ClassGenerator()
    ctx = new Context()
  })
  it('common usage', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('text-3xl font-bold underline')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('hello-world.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('trailing-slash.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 0', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('trailing-slash-0.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it.each([
    ['😀<div CLASS = \'text-xl\' title="text-xl">', '😀<div CLASS = \'tw-a\' title="text-xl">'],
    ['<div class=text-xl />', '<div class=tw-a />'],
    ['<div class="text&#45;xl &quot;safe&quot; &amp;">', '<div class="tw-a &quot;safe&quot; &amp;">'],
    ['<div class=text-xl&#32;other>', '<div class=tw-a&#32;other>'],
  ])('rewrites parsed attribute values without corrupting their boundaries: %s', (source, expected) => {
    ctx.replaceMap.set('text-xl', 'placeholder')
    expect(htmlHandler(source, { ctx }).code).toBe(expected)
  })

  it('leaves script, style, textarea and comment contents intact', () => {
    ctx.replaceMap.set('text-xl', 'placeholder')
    const source = '<!-- <div class="text-xl"> --><script>const text = \'<div class="text-xl">\'</script><style>.x { content: \'<div class="text-xl">\' }</style><textarea><div class="text-xl"></textarea><div class="text-xl">'
    const expected = source.replace('</textarea><div class="text-xl">', '</textarea><div class="tw-a">')
    expect(htmlHandler(source, { ctx }).code).toBe(expected)
  })

  it('applies original UTF-16 positions to an existing MagicString', () => {
    ctx.replaceMap.set('text-xl', 'placeholder')
    const source = new MagicString('😀<div class="text-xl">content</div>')
    source.overwrite(0, 2, '前缀')
    expect(htmlHandler(source, { ctx }).code).toBe('前缀<div class="tw-a">content</div>')
  })
})

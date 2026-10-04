import { Buffer } from 'node:buffer'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import { cssHandler } from '@/css'
import { transformSelectorPostcssPlugin } from '@/css/plugins'
import { Context } from '@/ctx'
import { jsHandler } from '@/js'
import { getTestCase } from './utils'

describe('css', () => {
  let ctx: Context
  beforeEach(() => {
    // classGenerator = new ClassGenerator()
    ctx = new Context()
  })

  it('preserveClassNamesSet case 0', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `.gap-y-4 {color:red;}`
    ctx.addPreserveClass('gap-y-4')
    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('preserveClassNamesSet case 1', async () => {
    await ctx.initConfig({
      classList: ['gap-y-4'],
    })
    const testCase = `.gap-y-4 {color:red;}`
    ctx.addPreserveClass('gap-y-4')
    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('preserveClassNamesSet case 2', async () => {
    await ctx.initConfig({
      classList: ['gap-y-4'],
    })
    const jsTestCase = `
    const twIgnore = String.raw
    element.innerHTML = \`<div class="\${twIgnore\`gap-y-4\`} lg:dark:bg-zinc-800/30">count is counter</div>\``
    jsHandler(jsTestCase, {
      ctx,
    })
    const testCase = `.gap-y-4 {color:red;}`

    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4 {
      }
    }`

    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('vue scoped no ignore .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('gap-y-4', 'tw-a')
    ctx.classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { code } = await cssHandler(testCase, {
      ctx,
      ignoreVueScoped: false,
    })
    expect(code).toMatchSnapshot()
  })

  it('common with scoped', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-white', 'tw-a')
    ctx.classGenerator.generateClassName('bg-white')
    const testCase = `
    .bg-white[data-v-0f84999b] {
      --tw-bg-opacity: 1;
      background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
    }`

    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('vue.scoped.css', async () => {
    const list = JSON.parse(getTestCase('nuxt-app-partial-class-set.json'))
    const replaceMap: Map<string, any> = ctx.replaceMap
    for (const cls of list) {
      replaceMap.set(cls, ctx.classGenerator.generateClassName(cls).name)
    }
    const testCase = getTestCase('vue.scoped.css')
    const { code } = await cssHandler(testCase, {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('replaces escaped class selectors emitted by Tailwind v4', async () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('hover:dark:bg-neutral-800/30', 'tw-a')
    replaceMap.set('group-hover:translate-x-1', 'tw-b')
    ctx.classGenerator.generateClassName('hover:dark:bg-neutral-800/30')
    ctx.classGenerator.generateClassName('group-hover:translate-x-1')

    const testCase = `
      .hover\\:dark\\:bg-neutral-800\\/30 {
        &:hover {
          @media (hover: hover) {
            @media (prefers-color-scheme: dark) {
              background-color: rgb(38 38 38 / .3);
            }
          }
        }
      }
      .group-hover\\:translate-x-1 {
        &:is(:where(.group):hover *) {
          --tw-translate-x: .25rem;
        }
      }
    `

    const { code } = await cssHandler(testCase, {
      ctx,
    })

    expect(code).toContain('.tw-a')
    expect(code).toContain('.tw-b')
    expect(code).not.toContain('.hover\\:dark\\:bg-neutral-800\\/30')
    expect(code).not.toContain('.group-hover\\:translate-x-1')
  })

  it.each([
    '.text-xl{color:red}',
    '@media screen{.text-xl:hover{color:red}.中文{color:blue}}',
    '.hover\\:bg-red\\/50:is(.text-xl,[class=".text-xl"]){content:".text-xl"}',
    '.text-xl[data-v-abcd],.text-xl [data-v-abcd],.text-xl[x="data-v-abcd"]{}',
    '.\\31 col{color:red}',
    '.text-xl{--raw:{.text-xl};a:hover{color:red}&:is(.中文){color:blue}}',
  ])('matches the previous parser for selectors and nested rules: %s', async (source) => {
    for (const [original, replacement] of [['text-xl', 'tw-a'], ['hover:bg-red/50', 'tw-b'], ['中文', 'tw-c'], ['1col', 'tw-d']] as const) {
      ctx.replaceMap.set(original, replacement)
    }
    ctx.addPreserveClass('text-xl')
    const reference = postcss.parse(source)
    reference.walkRules((rule) => {
      selectorParser((selectors) => {
        selectors.walkClasses((selector) => {
          const next = selector.next()
          if (next?.type === 'attribute' && next.attribute.includes('data-v-')) {
            return
          }
          const replacement = ctx.replaceMap.get(selector.value)
          if (replacement) {
            if (ctx.isPreserveClass(selector.value)) {
              rule.cloneBefore()
            }
            selector.value = replacement
          }
        })
      }).transformSync(rule, { lossless: false, updateSelector: true })
    })
    expect((await cssHandler(source, { ctx })).code).toBe(reference.toString())
  })

  it('keeps original formatting and CSS text outside selector classes', async () => {
    ctx.replaceMap.set('text-xl', 'tw-a')
    const source = '/* 😀 */\n.text-xl  >  :is(.text-xl, [class=".text-xl"]) { content: ".text-xl"; --raw: {.text-xl}; }'
    expect((await cssHandler(source, { ctx })).code).toBe('/* 😀 */\n.tw-a  >  :is(.tw-a, [class=".text-xl"]) { content: ".text-xl"; --raw: {.text-xl}; }')
  })

  it('retains the PostCSS adapter with the same native selector and preservation behavior', async () => {
    ctx.replaceMap.set('text-xl', 'tw-a')
    ctx.addPreserveClass('text-xl')
    const source = '@media screen{.text-xl:is(.text-xl){color:red}}'
    const result = await postcss([transformSelectorPostcssPlugin({ ctx })]).process(source, { from: undefined })
    expect(result.css).toBe((await cssHandler(source, { ctx })).code)
  })

  it.each(['.text-xl { color:red', '.text-xl { color:red } invalid'])('keeps invalid stylesheets intact: %s', async (source) => {
    ctx.replaceMap.set('text-xl', 'tw-a')
    expect((await cssHandler(source, { ctx })).code).toBe(source)
  })

  it.each(['\u00A0', '\u2000'])('keeps CSS non-ASCII identifier suffixes: %s', async (suffix) => {
    ctx.replaceMap.set('text-xl', 'tw-a')
    const source = `.text-xl${suffix}{color:red}`
    expect((await cssHandler(source, { ctx })).code).toBe(source)
  })

  it('composes inline previous maps and replaces their annotation', async () => {
    ctx.replaceMap.set('text-xl', 'tw-a')
    const original = '.text-xl { color: red }'
    const previous = {
      version: 3,
      sources: ['original.scss'],
      names: [],
      mappings: 'AAAA',
      sourcesContent: [original],
    }
    const annotation = Buffer.from(JSON.stringify(previous)).toString('base64')
    const source = `.text-xl{color:red}\n/*# sourceMappingURL=data:application/json;base64,${annotation} */`
    const result = await cssHandler(source, { ctx, id: '/styles/output.css' })
    expect(result.code).toContain('.tw-a{color:red}')
    expect(result.code).not.toContain(annotation)
    expect(result.code.match(/sourceMappingURL=/g)).toHaveLength(1)
    const input = new postcss.Input(result.code, { from: '/styles/output.css' })
    expect(input.map.consumer().originalPositionFor({ line: 1, column: 1 }).source).toBe('original.scss')
    expect(input.map.consumer().sourceContentFor('original.scss')).toBe(original)
  })

  it('resolves external previous maps from their own directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'twm-css-map-'))
    try {
      await mkdir(join(directory, 'maps'))
      const previous = { version: 3, sources: ['../original.scss'], names: [], mappings: 'AAAA', sourcesContent: ['.text-xl{}'] }
      await writeFile(join(directory, 'maps', 'input.map'), `)]}'\n${JSON.stringify(previous)}`)
      ctx.replaceMap.set('text-xl', 'tw-a')
      const source = '.text-xl{}\n/*# sourceMappingURL=maps/input.map */'
      const result = await cssHandler(source, { ctx, id: join(directory, 'output.css') })
      expect(result.code).toBe('.tw-a{}\n/*# sourceMappingURL=output.css.map */')
      expect(typeof result.map).toBe('string')
      expect(JSON.parse(result.map as string)).toMatchObject({ sources: ['original.scss'], sourcesContent: ['.text-xl{}'] })
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

import { cssHandler } from '@/css'
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
})

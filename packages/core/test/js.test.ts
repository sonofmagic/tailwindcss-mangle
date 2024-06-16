/* eslint-disable no-template-curly-in-string */
import MagicString from 'magic-string'
import { getCss, getTestCase } from './utils'
import { jsHandler, preProcessJs, preProcessRawCode } from '@/js'
// import { getStringLiteralCalleeName, getTemplateElementCalleeName } from '@/js/utils'
// import { ClassGenerator } from '@/shared'
import { Context } from '@/index'

// function jsHandler(str: string, options: any) {
//   return _jsHandler(str, options)
// }

describe('js handler', async () => {
  // let classGenerator: ClassGenerator
  let ctx: Context
  beforeEach(() => {
    // classGenerator = new ClassGenerator()
    ctx = new Context()
  })
  it('common StringLiteral', () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)

    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('common StringLiteral with splitQuote false', () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)

    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      ctx,
      splitQuote: false,
    }).code
    expect(code).toMatchSnapshot()
  })

  it('common TemplateElement', () => {
    const replaceMap = ctx.replaceMap
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)

    const testCase = 'const counter = 0;element.innerHTML = `<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is ${counter}</div>`'
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  // it('text-[red]', () => {
  //   const replaceMap = ctx.replaceMap

  //   // eslint-disable-next-line no-template-curly-in-string
  //   const testCase = ''
  //   testCase.split(' ').forEach((x) => {
  //     replaceMap.set(x)
  //   })
  //   const code = jsHandler(testCase, {
  //     ctx,
  //     replaceMap
  //   }).code
  //   expect(code).toMatchSnapshot()
  // })

  it('z-10 not transform', () => {
    const replaceMap = ctx.replaceMap
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      replaceMap.set(cls, true)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('z-10 not transform with splitQuote false', () => {
    const replaceMap = ctx.replaceMap
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      replaceMap.set(cls, true)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      ctx,

      splitQuote: false,
    }).code
    expect(code).toMatchSnapshot()
  })

  it('nextjs server side mangle', () => {
    const testCase = getTestCase('next-server-page.js')
    getCss(testCase)
    const list = require('./fixtures/tw-class-set.json') as string[]
    const replaceMap = ctx.replaceMap // getClassCacheSet()
    for (const cls of list) {
      replaceMap.set(cls, true)
    }
    expect(replaceMap.size).toBeGreaterThan(0)

    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('eval script case', () => {
    const testCase = getTestCase('webpack-dev-content.js')
    const list = require('./fixtures/tw-class-set.json') as string[]
    const replaceMap = ctx.replaceMap
    for (const cls of list) {
      replaceMap.set(cls, true)
    }
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('comment-ignore case', () => {
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js true', () => {
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      ctx,

      minified: true,
    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js with NODE_ENV', () => {
    process.env.NODE_ENV = 'production'
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })
  // https://github.com/sonofmagic/tailwindcss-mangle/issues/24
  it('trailing slash case 0', () => {
    const testCase = getTestCase('trailing-slash-0.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500', true)
    replaceMap.set('bg-red-500/50', true)
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 1', () => {
    const testCase = getTestCase('trailing-slash-1.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500/50', true)
    replaceMap.set('bg-red-500', true)

    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 2', () => {
    const testCase = getTestCase('trailing-slash-2.js')
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500/50', true)
    replaceMap.set('bg-red-500', true)

    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toMatchSnapshot()
  })

  it('lINEFEED case', () => {
    const testCase = 'const LINEFEED = "\\n";'

    // replaceMap.set('bg-red-500/50', true)
    // replaceMap.set('bg-red-500', true)
    const code = jsHandler(testCase, {
      ctx,

    }).code
    expect(code).toBe('const LINEFEED = "\\n";')
  })

  it('preProcessJs case', () => {
    const testCase = 'const LINEFEED = "\\n";'

    // replaceMap.set('bg-red-500/50', true)
    // replaceMap.set('bg-red-500', true)
    const code = preProcessJs({
      code: testCase,
      // @ts-ignore
      ctx: {
        addToUsedBy: () => { },
      },
      id: 'xxx',

    })
    expect(code).toBe(testCase)
  })

  it('preProcessJs TemplateElement case', () => {
    const testCase = 'const LINEFEED = `bg-red-500/50${n}bg-red-500/50`;'
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500/50', 'a')
    replaceMap.set('bg-red-500', 'b')
    const code = preProcessJs({
      code: testCase,
      // @ts-ignore
      ctx: {
        addToUsedBy: () => { },
        replaceMap,
      },
      id: 'xxx',

    })
    expect(code).toBe('const LINEFEED = `a${n}a`;')
  })

  it('preProcessJs MagicString TemplateElement case', () => {
    const testCase = new MagicString('const LINEFEED = `bg-red-500/50${n}bg-red-500/50`;')
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500/50', 'a')
    replaceMap.set('bg-red-500', 'b')
    const code = preProcessJs({
      code: testCase,
      // @ts-ignore
      ctx: {
        addToUsedBy: () => { },
        replaceMap,
      },
      id: 'xxx',

    })
    expect(code).toBe('const LINEFEED = `a${n}a`;')
  })

  it('preserve-fn-case0.js case 0', async () => {
    const testCase = getTestCase('preserve-fn-case0.js')

    await ctx.initConfig()
    const replaceMap = ctx.replaceMap
    replaceMap.set('bg-red-500/50', 'a')
    replaceMap.set('bg-red-500', 'b')
    const code = preProcessJs({
      code: testCase,
      ctx,
      id: 'xxx',
    })
    expect(code).toMatchSnapshot()
  })

  it('preserve-fn-case0.js case 1', async () => {
    const testCase = getTestCase('preserve-fn-case0.js')

    await ctx.initConfig({
      classList: 'bg-red-500/50 bg-red-500 w-2 h-2 w-1 h-1 bg-red-400 bg-red-400/50'.split(' '),
      mangleOptions: {
        preserveFunction: ['cn'],
      },
    })

    //     cn('w-10 h-10 bg-red-500 and bg-red-500/50')

    // cn(`w-2 h-2 bg-red-600 and bg-red-600/50`)

    // twMerge('w-1 h-1 bg-red-400 and bg-red-400/50')
    const replaceMap = ctx.getReplaceMap()
    const code = preProcessJs({
      code: testCase,
      ctx,
      id: 'xxx',

    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(4)
    expect(replaceMap).toMatchSnapshot()
    // expect(
    //   [...ctx.getReplaceMap().entries()].reduce<Record<string, string>>((acc, cur) => {
    //     acc[cur[0]] = cur[1]
    //     return acc
    //   }, {})
    // ).toMatchSnapshot()
  })

  it('preserve-fn-case0.js case 2', async () => {
    const testCase = getTestCase('preserve-fn-case0.js')

    await ctx.initConfig({
      classList: 'bg-red-500/50 bg-red-500 w-2 h-2 w-1 h-1 bg-red-400 bg-red-400/50'.split(' '),
      mangleOptions: {
        preserveFunction: ['twMerge'],
      },
    })

    const replaceMap = ctx.getReplaceMap()

    const code = preProcessJs({
      code: testCase,
      ctx,
      id: 'xxx',

    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(4)
    expect(replaceMap).toMatchSnapshot()
  })

  it('preserve-fn-case0.js case 3', async () => {
    const testCase = getTestCase('preserve-fn-case0.js')

    await ctx.initConfig({
      classList: 'bg-red-500/50 bg-red-500 w-2 h-2 w-1 h-1 bg-red-400 bg-red-400/50'.split(' '),
      mangleOptions: {
        preserveFunction: ['twMerge', 'cn'],
      },
    })

    const replaceMap = ctx.getReplaceMap()

    //     cn('w-10 h-10 bg-red-500 and bg-red-500/50')

    // cn(`w-2 h-2 bg-red-600 and bg-red-600/50`)

    // twMerge('w-1 h-1 bg-red-400 and bg-red-400/50')
    const code = preProcessJs({
      code: testCase,
      ctx,
      id: 'xxx',

    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(8)
    expect(ctx.getReplaceMap()).toMatchSnapshot()
  })

  it('preProcessRawCode case 0', async () => {
    const testCase = getTestCase('preserve-fn-case0.vue')
    await ctx.initConfig({
      classList: 'px-2 py-1 bg-red hover:bg-dark-red p-3 bg-[#B91C1C] flex min-h-screen flex-col items-center justify-between p-24'.split(' '),
      mangleOptions: {
        preserveFunction: ['twMerge'],
      },
    })

    const replaceMap = ctx.getReplaceMap()

    const code = preProcessRawCode({
      code: testCase,
      ctx,

      id: 'xxx',
    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(6)
    expect(replaceMap).toMatchSnapshot()
  })

  it('preProcessRawCode case 1', async () => {
    const testCase = getTestCase('preserve-fn-case1.vue')

    await ctx.initConfig({
      classList: require('./fixtures/preserve-fn-case1.json') as string[],
      mangleOptions: {
        preserveFunction: ['twMerge'],
      },
    })
    const replaceMap = ctx.getReplaceMap()
    const code = preProcessRawCode({
      code: testCase,
      ctx,

      id: 'xxx',
    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(6)
    expect(replaceMap).toMatchSnapshot()
  })

  it('preProcessRawCode case 2', async () => {
    const testCase = getTestCase('preserve-fn-case2.vue')

    await ctx.initConfig({
      classList: require('./fixtures/preserve-fn-case2.json') as string[],
      mangleOptions: {
        preserveFunction: ['twMerge'],
      },
    })
    const replaceMap = ctx.getReplaceMap()

    const code = preProcessRawCode({
      code: testCase,
      ctx,
      id: 'xxx',
    })
    expect(code).toMatchSnapshot()
    expect(ctx.preserveClassNamesSet.size).toBe(8)
    expect(replaceMap).toMatchSnapshot()
  })

  it('tsx app0', async () => {
    await ctx.initConfig({
      classList: require('./fixtures/app0.json') as string[],
    })
    const replaceMap = ctx.getReplaceMap()
    const code = getTestCase('app0.tsx')

    const res = preProcessJs({
      code,

      ctx,
      id: 'xxx',
    })
    expect(res).toMatchSnapshot()
  })

  it('ts vanilla-0', async () => {
    await ctx.initConfig({
      classList: require('./fixtures/vanilla-0.json') as string[],
    })
    const replaceMap = ctx.getReplaceMap()
    const code = getTestCase('vanilla-0.ts')

    const res = preProcessJs({
      code,

      ctx,
      id: 'xxx',
    })
    expect(res).toMatchSnapshot()
  })

  it('cn', async () => {
    const code = `const bbb = cn(
      {
        'p-3': true
      },
      'p-1',
      ['p-2', true && 'p-4']
    )`
    await ctx.initConfig({
      classList: 'p-1 p-2 p-3 p-4'.split(' '),
      mangleOptions: {
        preserveFunction: ['cn'],
      },
    })

    const res = preProcessJs({
      code,

      ctx,
      id: 'xxx',
    })
    expect(res).toMatchSnapshot()
  })
})

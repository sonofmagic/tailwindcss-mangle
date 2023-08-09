import { getCss, getTestCase } from './utils'
import { jsHandler } from '@/js'
import { ClassGenerator } from '@/shared'

describe('js handler', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })
  it('common StringLiteral', () => {
    const replaceMap = new Map()
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('common StringLiteral with splitQuote false', () => {
    const replaceMap = new Map()
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap,
      splitQuote: false
    }).code
    expect(code).toMatchSnapshot()
  })

  it('common TemplateElement', () => {
    const replaceMap = new Map()
    replaceMap.set('dark:bg-zinc-800/30', true)
    replaceMap.set('lg:dark:bg-zinc-800/30', true)
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'const counter = 0;element.innerHTML = `<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is ${counter}</div>`'
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  // it('text-[red]', () => {
  //   const replaceMap = new Map()

  //   // eslint-disable-next-line no-template-curly-in-string
  //   const testCase = ''
  //   testCase.split(' ').forEach((x) => {
  //     replaceMap.set(x)
  //   })
  //   const code = jsHandler(testCase, {
  //     classGenerator,
  //     replaceMap
  //   }).code
  //   expect(code).toMatchSnapshot()
  // })

  it('z-10 not transform', () => {
    const replaceMap = new Map()
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      replaceMap.set(cls, true)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('z-10 not transform with splitQuote false', () => {
    const replaceMap = new Map()
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      replaceMap.set(cls, true)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap,
      splitQuote: false
    }).code
    expect(code).toMatchSnapshot()
  })

  it('nextjs server side mangle', () => {
    const testCase = getTestCase('next-server-page.js')
    getCss(testCase)
    const list = require('./fixtures/tw-class-set.json') as string[]
    const replaceMap = new Map() // getClassCacheSet()
    for (const cls of list) {
      replaceMap.set(cls, true)
    }
    expect(replaceMap.size).toBeGreaterThan(0)

    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('eval script case', () => {
    const testCase = getTestCase('webpack-dev-content.js')
    const list = require('./fixtures/tw-class-set.json') as string[]
    const replaceMap = new Map()
    for (const cls of list) {
      replaceMap.set(cls, true)
    }
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('comment-ignore case', () => {
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = new Map()
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js true', () => {
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = new Map()
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap,
      minified: true
    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js with NODE_ENV', () => {
    process.env.NODE_ENV = 'production'
    const testCase = getTestCase('comment-ignore.js')
    const replaceMap = new Map()
    replaceMap.set('ease-out', true)
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })
  // https://github.com/sonofmagic/tailwindcss-mangle/issues/24
  it('trailing slash case 0', () => {
    const testCase = getTestCase('trailing-slash-0.js')
    const replaceMap = new Map()
    replaceMap.set('bg-red-500', true)
    replaceMap.set('bg-red-500/50', true)
    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 1', () => {
    const testCase = getTestCase('trailing-slash-1.js')
    const replaceMap = new Map()
    replaceMap.set('bg-red-500/50', true)
    replaceMap.set('bg-red-500', true)

    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 2', () => {
    const testCase = getTestCase('trailing-slash-2.js')
    const replaceMap = new Map()
    replaceMap.set('bg-red-500/50', true)
    replaceMap.set('bg-red-500', true)

    const code = jsHandler(testCase, {
      classGenerator,
      replaceMap
    }).code
    expect(code).toMatchSnapshot()
  })
})

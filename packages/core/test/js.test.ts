import { jsHandler } from '@/js'
import { getCss, getTestCase } from './utils'
import { ClassGenerator } from '@/shared'

describe('js handler', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })
  it('common StringLiteral', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('dark:bg-zinc-800/30')
    runtimeSet.add('lg:dark:bg-zinc-800/30')
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('common StringLiteral with splitQuote false', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('dark:bg-zinc-800/30')
    runtimeSet.add('lg:dark:bg-zinc-800/30')
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'element.innerHTML = \'<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is counter</div>\''
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet,
      splitQuote: false
    }).code
    expect(code).toMatchSnapshot()
  })

  it('common TemplateElement', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('dark:bg-zinc-800/30')
    runtimeSet.add('lg:dark:bg-zinc-800/30')
    // eslint-disable-next-line no-template-curly-in-string
    const testCase = 'const counter = 0;element.innerHTML = `<div class="dark:bg-zinc-800/30 lg:dark:bg-zinc-800/30">count is ${counter}</div>`'
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  // it('text-[red]', () => {
  //   const runtimeSet = new Set<string>()

  //   // eslint-disable-next-line no-template-curly-in-string
  //   const testCase = ''
  //   testCase.split(' ').forEach((x) => {
  //     runtimeSet.add(x)
  //   })
  //   const code = jsHandler(testCase, {
  //     classGenerator,
  //     runtimeSet
  //   }).code
  //   expect(code).toMatchSnapshot()
  // })

  it('z-10 not transform', () => {
    const runtimeSet = new Set<string>()
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      runtimeSet.add(cls)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('z-10 not transform with splitQuote false', () => {
    const runtimeSet = new Set<string>()
    for (const cls of 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')) {
      runtimeSet.add(cls)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet,
      splitQuote: false
    }).code
    expect(code).toMatchSnapshot()
  })

  it('nextjs server side mangle', () => {
    const testCase = getTestCase('next-server-page.js')
    getCss(testCase)
    const runtimeSet = new Set(require('./fixtures/tw-class-set.json') as string[]) // getClassCacheSet()
    expect(runtimeSet.size).toBeGreaterThan(0)

    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('eval script case', () => {
    const testCase = getTestCase('webpack-dev-content.js')
    const runtimeSet = new Set(require('./fixtures/tw-class-set.json') as string[])
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('comment-ignore case', () => {
    const testCase = getTestCase('comment-ignore.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('ease-out')
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js true', () => {
    const testCase = getTestCase('comment-ignore.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('ease-out')
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet,
      minified: true
    }).code
    expect(code).toMatchSnapshot()
  })

  it('minified js with NODE_ENV', () => {
    process.env.NODE_ENV = 'production'
    const testCase = getTestCase('comment-ignore.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('ease-out')
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })
  // https://github.com/sonofmagic/tailwindcss-mangle/issues/24
  it('trailing slash case 0', () => {
    const testCase = getTestCase('trailing-slash-0.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('bg-red-500')
    runtimeSet.add('bg-red-500/50')
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 1', () => {
    const testCase = getTestCase('trailing-slash-1.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('bg-red-500/50')
    runtimeSet.add('bg-red-500')

    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 2', () => {
    const testCase = getTestCase('trailing-slash-2.js')
    const runtimeSet = new Set<string>()
    runtimeSet.add('bg-red-500/50')
    runtimeSet.add('bg-red-500')

    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })
})

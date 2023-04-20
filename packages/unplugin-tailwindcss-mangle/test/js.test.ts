import { jsHandler } from '../src/js/index'
import ClassGenerator from '../src/classGenerator'
describe('js handler', () => {
  it('common StringLiteral', () => {
    const classGenerator = new ClassGenerator()
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

  it('common TemplateElement', () => {
    const classGenerator = new ClassGenerator()
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

  it('z-10 not transform', () => {
    const classGenerator = new ClassGenerator()
    const runtimeSet = new Set<string>()
    const arr = 'z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex'.split(' ')
    for (let i = 0; i < arr.length; i++) {
      const element = arr[i]
      runtimeSet.add(element)
    }

    const testCase = `{ className: "z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex" }`
    const code = jsHandler(testCase, {
      classGenerator,
      runtimeSet
    }).code
    expect(code).toMatchSnapshot()
  })
})

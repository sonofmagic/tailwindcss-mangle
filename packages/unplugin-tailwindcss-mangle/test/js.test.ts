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
})

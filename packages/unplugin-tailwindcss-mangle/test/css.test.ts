import ClassGenerator from '../src/classGenerator'
import { cssHandler } from '../src/css/index'

describe('css', () => {
  it('vue scoped .gap-y-4[data-v-0f84999b]', () => {
    const classGenerator = new ClassGenerator()
    const runtimeSet = new Set<string>()
    runtimeSet.add('gap-y-4')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`
    const css = cssHandler(testCase, {
      classGenerator,
      runtimeSet
    })
    expect(css).toMatchSnapshot()
  })
})

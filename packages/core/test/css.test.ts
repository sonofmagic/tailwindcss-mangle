import { cssHandler } from '@/css'
import { ClassGenerator } from '@/shared'
import { getTestCase } from './utils'
describe('css', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })

  it('vue scoped .gap-y-4', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('gap-y-4')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4 {
      }
    }`

    const css = cssHandler(testCase, {
      classGenerator,
      runtimeSet
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4[data-v-0f84999b]', () => {
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

  it('vue scoped no ignore .gap-y-4[data-v-0f84999b]', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('gap-y-4')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const css = cssHandler(testCase, {
      classGenerator,
      runtimeSet,
      ignoreVueScoped: false
    })
    expect(css).toMatchSnapshot()
  })

  it('common with scoped', () => {
    const runtimeSet = new Set<string>()
    runtimeSet.add('bg-white')
    classGenerator.generateClassName('bg-white')
    const testCase = `
    .bg-white[data-v-0f84999b] {
      --tw-bg-opacity: 1;
      background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
    }`

    const css = cssHandler(testCase, {
      classGenerator,
      runtimeSet
    })
    expect(css).toMatchSnapshot()
  })

  it('vue.scoped.css', () => {
    const runtimeSet: Set<string> = new Set(JSON.parse(getTestCase('nuxt-app-partial-class-set.json')))
    const testCase = getTestCase('vue.scoped.css')
    const css = cssHandler(testCase, {
      classGenerator,
      runtimeSet
    })
    expect(css).toMatchSnapshot()
  })
})

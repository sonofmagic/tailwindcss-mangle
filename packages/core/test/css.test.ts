import { getTestCase } from './utils'
import { cssHandler } from '@/css'
import { ClassGenerator } from '@/shared'
describe('css', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })

  it('vue scoped .gap-y-4', async () => {
    const replaceMap = new Map()
    replaceMap.set('gap-y-4', 'tw-a')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4 {
      }
    }`

    const { css } = await cssHandler(testCase, {
      classGenerator,
      replaceMap
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = new Map()
    replaceMap.set('gap-y-4', 'tw-a')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { css } = await cssHandler(testCase, {
      classGenerator,
      replaceMap
    })
    expect(css).toMatchSnapshot()
  })

  it('vue scoped no ignore .gap-y-4[data-v-0f84999b]', async () => {
    const replaceMap = new Map()
    replaceMap.set('gap-y-4', 'tw-a')
    classGenerator.generateClassName('gap-y-4')
    const testCase = `@media (min-width: 768px) {
      .gap-y-4[data-v-0f84999b] {
      }
    }`

    const { css } = await cssHandler(testCase, {
      classGenerator,
      replaceMap,
      ignoreVueScoped: false
    })
    expect(css).toMatchSnapshot()
  })

  it('common with scoped', async () => {
    const replaceMap = new Map()
    replaceMap.set('bg-white', 'tw-a')
    classGenerator.generateClassName('bg-white')
    const testCase = `
    .bg-white[data-v-0f84999b] {
      --tw-bg-opacity: 1;
      background-color: rgba(255, 255, 255, var(--tw-bg-opacity));
    }`

    const { css } = await cssHandler(testCase, {
      classGenerator,
      replaceMap
    })
    expect(css).toMatchSnapshot()
  })

  it('vue.scoped.css', async () => {
    const list = JSON.parse(getTestCase('nuxt-app-partial-class-set.json'))
    const replaceMap: Map<string, any> = new Map()
    for (const cls of list) {
      replaceMap.set(cls, classGenerator.generateClassName(cls).name)
    }
    const testCase = getTestCase('vue.scoped.css')
    const { css } = await cssHandler(testCase, {
      classGenerator,
      replaceMap
    })
    expect(css).toMatchSnapshot()
  })
})

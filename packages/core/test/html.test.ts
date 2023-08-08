import { ClassGenerator, splitCode } from '@tailwindcss-mangle/shared'
import { getTestCase } from './utils'
import { htmlHandler } from '@/html'

describe('html handler', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })
  it('common usage', () => {
    const runtimeSet = new Set<string>()

    for (const x of splitCode('text-3xl font-bold underline')) {
      runtimeSet.add(x)
    }
    const res = htmlHandler(getTestCase('hello-world.html'), {
      classGenerator,
      runtimeSet
    })
    expect(res).toMatchSnapshot()
  })

  it('trailing slash case', () => {
    const runtimeSet = new Set<string>()

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      runtimeSet.add(x)
    }
    const res = htmlHandler(getTestCase('trailing-slash.html'), {
      classGenerator,
      runtimeSet
    })
    expect(res).toMatchSnapshot()
  })

  it('trailing slash case 0', () => {
    const runtimeSet = new Set<string>()

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      runtimeSet.add(x)
    }
    const res = htmlHandler(getTestCase('trailing-slash-0.html'), {
      classGenerator,
      runtimeSet
    })
    expect(res).toMatchSnapshot()
  })
})

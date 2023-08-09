import { ClassGenerator, splitCode } from '@tailwindcss-mangle/shared'
import { getTestCase } from './utils'
import { htmlHandler } from '@/html'

describe('html handler', () => {
  let classGenerator: ClassGenerator
  beforeEach(() => {
    classGenerator = new ClassGenerator()
  })
  it('common usage', () => {
    const replaceMap = new Map()

    for (const x of splitCode('text-3xl font-bold underline')) {
      replaceMap.set(x, true)
    }
    const res = htmlHandler(getTestCase('hello-world.html'), {
      classGenerator,
      replaceMap
    })
    expect(res).toMatchSnapshot()
  })

  it('trailing slash case', () => {
    const replaceMap = new Map()

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, true)
    }
    const res = htmlHandler(getTestCase('trailing-slash.html'), {
      classGenerator,
      replaceMap
    })
    expect(res).toMatchSnapshot()
  })

  it('trailing slash case 0', () => {
    const replaceMap = new Map()

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, true)
    }
    const res = htmlHandler(getTestCase('trailing-slash-0.html'), {
      classGenerator,
      replaceMap
    })
    expect(res).toMatchSnapshot()
  })
})

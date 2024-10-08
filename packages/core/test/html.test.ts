import { Context } from '@/ctx'
import { htmlHandler } from '@/html'
import { splitCode } from '@tailwindcss-mangle/shared'
import { getTestCase } from './utils'

describe('html handler', () => {
  // let classGenerator: ClassGenerator
  let ctx: Context
  beforeEach(() => {
    // classGenerator = new ClassGenerator()
    ctx = new Context()
  })
  it('common usage', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('text-3xl font-bold underline')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('hello-world.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('trailing-slash.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })

  it('trailing slash case 0', () => {
    const replaceMap = ctx.replaceMap

    for (const x of splitCode('bg-red-500 bg-red-500/50')) {
      replaceMap.set(x, '1')
    }
    const { code } = htmlHandler(getTestCase('trailing-slash-0.html'), {
      ctx,
    })
    expect(code).toMatchSnapshot()
  })
})

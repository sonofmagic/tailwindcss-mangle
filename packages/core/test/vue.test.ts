import { getTestCase } from './utils'
import { Context } from '@/ctx'
import { vueHandler } from '@/vue'

// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/__tests__/templateTransformAssetUrl.spec.ts
describe('vue', () => {
  let ctx: Context
  beforeEach(() => {
    ctx = new Context()
  })
  it('test for vue', () => {
    const testCase = getTestCase('preserve-fn-case1.vue')
    expect(vueHandler(testCase, {
      ctx,
    })).toMatchSnapshot()
  })
})

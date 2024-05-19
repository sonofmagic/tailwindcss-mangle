import { parse } from '@vue/compiler-sfc'
import type {
  NodeTransform,
  RootNode,
} from '@vue/compiler-core'
import {
  CREATE_VNODE,
  RESOLVE_DIRECTIVE,
  baseParse,
  createSimpleExpression,
  generate,
  helperNameMap,
  locStub,
  transform,
} from '@vue/compiler-core'
import { getTestCase } from './utils'

const NodeTypes = {
  ROOT: 0,
  ELEMENT: 1,
  TEXT: 2,
  COMMENT: 3,
  SIMPLE_EXPRESSION: 4,
  INTERPOLATION: 5,
  ATTRIBUTE: 6,
  DIRECTIVE: 7,
  COMPOUND_EXPRESSION: 8,
  IF: 9,
  IF_BRANCH: 10,
  FOR: 11,
  TEXT_CALL: 12,
  VNODE_CALL: 13,
  JS_CALL_EXPRESSION: 14,
  JS_OBJECT_EXPRESSION: 15,
  JS_PROPERTY: 16,
  JS_ARRAY_EXPRESSION: 17,
  JS_FUNCTION_EXPRESSION: 18,
  JS_CONDITIONAL_EXPRESSION: 19,
  JS_CACHE_EXPRESSION: 20,
  JS_BLOCK_STATEMENT: 21,
  JS_TEMPLATE_LITERAL: 22,
  JS_IF_STATEMENT: 23,
  JS_ASSIGNMENT_EXPRESSION: 24,
  JS_SEQUENCE_EXPRESSION: 25,
  JS_RETURN_STATEMENT: 26,
} as const

function createRoot(options: Partial<RootNode> = {}): RootNode {
  return {
    type: 0, // NodeTypes.ROOT,
    children: [],
    helpers: new Set(),
    components: [],
    directives: [],
    imports: [],
    hoists: [],
    cached: 0,
    temps: 0,
    codegenNode: createSimpleExpression(`null`, false),
    loc: locStub,
    ...options,
  }
}
// https://github.com/vuejs/core/blob/main/packages/compiler-sfc/__tests__/templateTransformAssetUrl.spec.ts
describe('vue', () => {
  it('module mode preamble', () => {
    const root = createRoot({
      helpers: new Set([CREATE_VNODE, RESOLVE_DIRECTIVE]),
    })
    const { code } = generate(root, { mode: 'module' })
    expect(code).toMatch(
      `import { ${helperNameMap[CREATE_VNODE]} as _${helperNameMap[CREATE_VNODE]}, ${helperNameMap[RESOLVE_DIRECTIVE]} as _${helperNameMap[RESOLVE_DIRECTIVE]} } from "vue"`,
    )
    expect(code).toMatchSnapshot()
  })
  it.skip('test for vue', () => {
    const testCase = getTestCase('preserve-fn-case1.vue')
    const result = parse(testCase)

    console.log(result.descriptor.template, result.descriptor.script, result.descriptor.scriptSetup)
    const content = result.descriptor.template?.content ?? ''
    const ast = baseParse(content)
    const plugin: NodeTransform = (node, context) => {
      if (node.type === NodeTypes.ELEMENT && node.tag === 'div') {
        // change the node to <p>
        context.replaceNode(
          Object.assign({}, node, {
            tag: 'p',
            children: [
              {
                type: NodeTypes.TEXT,
                content: 'hello',
                isEmpty: false,
              },
            ],
          }),
        )
      }
    }
    transform(ast, {
      nodeTransforms: [plugin],
    })
    const t = generate(ast, { mode: 'module' })
    expect(t.code).toBe(content)
  })
})

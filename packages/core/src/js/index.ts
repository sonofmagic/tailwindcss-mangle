import type { StringLiteral, TemplateElement, CallExpression } from '@babel/types'
import * as t from '@babel/types'
import { transformSync, type BabelFileResult, type NodePath } from '@babel/core'
import type { IJsHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'

export function handleValue(str: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions) {
  const { runtimeSet: set, classGenerator: clsGen, splitQuote = true } = options

  const arr = splitCode(str, {
    splitQuote
  })
  let rawStr = str
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (set.has(v)) {
      let ignoreFlag = false
      if (Array.isArray(node.leadingComments)) {
        ignoreFlag = node.leadingComments.findIndex((x) => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
      }

      if (!ignoreFlag) {
        rawStr = rawStr.replace(makeRegex(v), clsGen.generateClassName(v).name)
      }
    }
  }
  return rawStr
}

export function jsHandler(rawSource: string, options: IJsHandlerOptions) {
  const result = transformSync(rawSource, {
    babelrc: false,
    ast: true,
    plugins: [
      () => {
        return {
          visitor: {
            StringLiteral: {
              enter(p: NodePath<StringLiteral>) {
                const n = p.node
                n.value = handleValue(n.value, n, options)
              }
            },
            TemplateElement: {
              enter(p: NodePath<TemplateElement>) {
                const n = p.node
                n.value.raw = handleValue(n.value.raw, n, options)
              }
            },
            CallExpression: {
              enter(p: NodePath<CallExpression>) {
                const n = p.node
                // eval()
                if (t.isIdentifier(n.callee) && n.callee.name === 'eval') {
                  if (t.isStringLiteral(n.arguments[0])) {
                    const res = jsHandler(n.arguments[0].value, options)
                    if (res.code) {
                      n.arguments[0].value = res.code
                    }
                  }
                }
              }
            }
            // noScope: true
          }
        }
      }
    ],
    sourceMaps: false,
    configFile: false
  })

  return result as BabelFileResult
}

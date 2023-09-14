import type { StringLiteral, TemplateElement, CallExpression } from '@babel/types'
import { transformSync, type BabelFileResult, type NodePath } from '@babel/core'
import type { IJsHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'
import { isProd as isProduction } from '../env'
export { preProcessJs } from './pre'
export function handleValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions) {
  const { replaceMap, ctx, splitQuote = true } = options
  const clsGen = ctx.classGenerator
  const array = splitCode(raw, {
    splitQuote
  })
  let rawString = raw
  for (const v of array) {
    if (replaceMap.has(v)) {
      let ignoreFlag = false
      if (Array.isArray(node.leadingComments)) {
        ignoreFlag = node.leadingComments.findIndex((x) => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
      }

      if (!ignoreFlag) {
        rawString = rawString.replace(makeRegex(v), clsGen.generateClassName(v).name)
      }
    }
  }
  return rawString
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
                const calleePath = p.get('callee')
                if (calleePath.isIdentifier() && calleePath.node.name === 'eval') {
                  p.traverse({
                    StringLiteral: {
                      enter(s) {
                        // ___CSS_LOADER_EXPORT___
                        const res = jsHandler(s.node.value, options)
                        if (res.code) {
                          s.node.value = res.code
                        }
                      }
                    }
                  })
                }
              }
            }
            // noScope: true
          }
        }
      }
    ],
    minified: options.minified ?? isProduction(),
    sourceMaps: false,
    configFile: false
  })

  return result as BabelFileResult
}

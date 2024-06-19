import type { StringLiteral, TemplateElement } from '@babel/types'
import MagicString from 'magic-string'
import { jsStringEscape } from '@ast-core/escape'
import type { IJsHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'
import { parse, traverse } from '@/babel'

export { preProcessJs, preProcessRawCode } from './pre'

export function handleValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions, ms: MagicString, offset: number, escape: boolean) {
  const { ctx, splitQuote = true } = options
  const { replaceMap, classGenerator: clsGen } = ctx

  const array = splitCode(raw, {
    splitQuote,
  })
  let rawString = raw
  let needUpdate = false
  for (const v of array) {
    if (replaceMap.has(v)) {
      let ignoreFlag = false
      if (Array.isArray(node.leadingComments)) {
        ignoreFlag = node.leadingComments.findIndex(x => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
      }

      if (!ignoreFlag) {
        rawString = rawString.replace(makeRegex(v), clsGen.generateClassName(v).name)
        needUpdate = true
      }
    }
  }
  if (needUpdate && typeof node.start === 'number' && typeof node.end === 'number') {
    const start = node.start + offset
    const end = node.end - offset

    if (start < end && raw !== rawString) {
      ms.update(start, end, escape ? jsStringEscape(rawString) : rawString)
    }
  }
  return rawString
}

export function jsHandler(rawSource: string | MagicString, options: IJsHandlerOptions) {
  const ms: MagicString = typeof rawSource === 'string' ? new MagicString(rawSource) : rawSource
  const ast = parse(ms.original, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'jsx'],
  })
  traverse(ast, {
    StringLiteral: {
      enter(p) {
        const n = p.node
        handleValue(n.value, n, options, ms, 1, true)
      },
    },
    TemplateElement: {
      enter(p) {
        const n = p.node
        handleValue(n.value.raw, n, options, ms, 0, false)
      },
    },
    // CallExpression: {
    //   enter(p: NodePath<CallExpression>) {
    //     const calleePath = p.get('callee')
    //     if (calleePath.isIdentifier() && calleePath.node.name === 'eval') {
    //       p.traverse({
    //         StringLiteral: {
    //           enter(s) {
    //             // ___CSS_LOADER_EXPORT___
    //             const res = jsHandler(s.node.value, options)
    //             if (res.code) {
    //               s.node.value = res.code
    //             }
    //           },
    //         },
    //       })
    //     }
    //   },
    // },
  })

  return {
    code: ms.toString(),
    get map() {
      return ms.generateMap()
    },
  }
}

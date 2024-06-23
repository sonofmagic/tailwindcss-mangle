import type { StringLiteral, TemplateElement } from '@babel/types'
import MagicString from 'magic-string'
import { jsStringEscape } from '@ast-core/escape'
import { sort } from 'fast-sort'
import type { IHandlerTransformResult, IJsHandlerOptions } from '@/types'
import { makeRegex, splitCode } from '@/shared'
import { parse, traverse } from '@/babel'

export function handleValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions, ms: MagicString, offset: number, escape: boolean) {
  const { ctx, splitQuote = true, id } = options
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
        const gen = clsGen.generateClassName(v)
        rawString = rawString.replace(makeRegex(v), gen.name)
        ctx.addToUsedBy(v, id)
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

export function jsHandler(rawSource: string | MagicString, options: IJsHandlerOptions): IHandlerTransformResult {
  const ms: MagicString = typeof rawSource === 'string' ? new MagicString(rawSource) : rawSource
  let ast
  try {
    ast = parse(ms.original, {
      sourceType: 'unambiguous',
    })
  }
  catch (error) {
    return {
      code: ms.original,
    }
  }
  const { ctx } = options

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
    CallExpression: {
      enter(p) {
        const callee = p.get('callee')
        if (callee.isIdentifier() && ctx.isPreserveFunction(callee.node.name)) {
          p.traverse({
            StringLiteral: {
              enter(path) {
                const node = path.node
                const value = node.value
                const arr = sort(splitCode(value)).desc(x => x.length)

                for (const str of arr) {
                  if (ctx.replaceMap.has(str)) {
                    ctx.addPreserveClass(str)
                  }
                }
              },
            },
            TemplateElement: {
              enter(path) {
                const node = path.node
                const value = node.value.raw
                const arr = sort(splitCode(value)).desc(x => x.length)

                for (const str of arr) {
                  if (ctx.replaceMap.has(str)) {
                    ctx.addPreserveClass(str)
                  }
                }
              },
            },
          })
        }
      },
    },
  })

  return {
    code: ms.toString(),
    get map() {
      return ms.generateMap()
    },
  }
}

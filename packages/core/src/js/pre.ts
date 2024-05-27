import babel from '@babel/core'
import { declare } from '@babel/helper-plugin-utils'
import MagicString from 'magic-string'
import { splitCode } from '@tailwindcss-mangle/shared'
import { sort } from 'fast-sort'
import { jsStringEscape } from '@ast-core/escape'
import type { ParseResult } from '@babel/parser'
import { escapeStringRegexp } from '@/utils'
import type { Context } from '@/ctx'
import { between } from '@/math'

interface Options {
  replaceMap: Map<string, string>
  magicString: MagicString
  id: string
  ctx: Context
  markedArray: [number, number][]
}

type HandleValueOptions = {
  raw: string
  path: babel.NodePath<babel.types.StringLiteral | babel.types.TemplateElement>
  offset: number
  escape: boolean
} & Options

export function handleValue(options: HandleValueOptions) {
  const { ctx, id, path, magicString, raw, replaceMap, offset = 0, escape = false, markedArray } = options
  const node = path.node
  let value = raw
  // why 字符串字面量只要开始和结束 在 方法节点内就保留, 另外不可能出现 字符串字面量 开始和结束的下标整个包括 方法体，这是不可能出现的事情
  for (const [s, e] of markedArray) {
    if (between(node.start, s, e) || between(node.end, s, e)) {
      return
    }
  }

  const arr = sort(splitCode(value)).desc(x => x.length)

  for (const str of arr) {
    if (replaceMap.has(str)) {
      ctx.addToUsedBy(str, id)

      // replace
      const v = replaceMap.get(str)
      if (v) {
        value = value.replaceAll(str, v)
      }
    }
  }

  if (typeof node.start === 'number' && typeof node.end === 'number' && value) {
    const start = node.start + offset
    const end = node.end - offset
    if (start < end) {
      magicString.update(start, end, escape ? jsStringEscape(value) : value)
    }
  }
}

export const JsPlugin = declare((api, options: Options) => {
  api.assertVersion(7)
  const { magicString, replaceMap, id, ctx, markedArray } = options
  return {
    visitor: {
      StringLiteral: {
        exit(p) {
          const opts: HandleValueOptions = {
            ctx,
            id,
            magicString,
            path: p,
            raw: p.node.value,
            replaceMap,
            offset: 1,
            escape: true,
            markedArray,
          }

          handleValue(opts)
        },
      },
      TemplateElement: {
        exit(p) {
          const opts: HandleValueOptions = {
            ctx,
            id,
            magicString,
            path: p,
            raw: p.node.value.raw,
            replaceMap,
            offset: 0,
            escape: false,
            markedArray,
          }

          handleValue(opts)
        },
      },
    },
  }
})

interface IPreProcessJsOptions {
  code: string | MagicString
  replaceMap: Map<string, string>
  id: string
  ctx: Context
}

function transformSync(ast: babel.types.Node, code: string, plugins: babel.PluginItem[] | null | undefined, filename: string | null | undefined) {
  babel.transformFromAstSync(ast, code, {
    presets: loadPresets(),
    plugins,
    filename,
  })
}

export function loadPresets() {
  return [
    [
      require('@babel/preset-typescript'),
      {
        allExtensions: true,
        isTSX: true,
      },
    ],
  ]
}

export function preProcessJs(options: IPreProcessJsOptions): string {
  const { code, replaceMap, id, ctx } = options
  const magicString = typeof code === 'string' ? new MagicString(code) : code
  let ast: ParseResult<babel.types.File>
  try {
    const file = babel.parseSync(magicString.original, {
      sourceType: 'unambiguous',
      presets: loadPresets(),
    })
    if (file) {
      ast = file
    }
    else {
      return code.toString()
    }
  }
  catch {
    return code.toString()
  }
  const markedArray: [number, number][] = []
  babel.traverse(ast, {
    CallExpression: {
      enter(p) {
        const callee = p.get('callee')
        if (callee.isIdentifier() && ctx.isPreserveFunction(callee.node.name)) {
          if (p.node.start && p.node.end) {
            markedArray.push([p.node.start, p.node.end])
          }

          p.traverse({
            StringLiteral: {
              enter(path) {
                const node = path.node
                const value = node.value
                const arr = sort(splitCode(value)).desc(x => x.length)

                for (const str of arr) {
                  if (replaceMap.has(str)) {
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
                  if (replaceMap.has(str)) {
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

  transformSync(
    ast,
    magicString.original,
    [
      [
        JsPlugin,
        {
          magicString,
          replaceMap,
          id,
          ctx,
          markedArray,
        },
      ],
    ],
    id,
  )

  return magicString.toString()
}

interface IPreProcessRawCodeOptions {
  code: string | MagicString
  replaceMap: Map<string, string>
  id: string
  ctx: Context
}

export function preProcessRawCode(options: IPreProcessRawCodeOptions): string {
  const { code, replaceMap, ctx } = options
  const magicString = typeof code === 'string' ? new MagicString(code) : code
  const markArr: [number, number][] = []
  for (const regex of ctx.preserveFunctionRegexs) {
    const allArr: RegExpExecArray[] = []
    let arr: RegExpExecArray | null = null
    while ((arr = regex.exec(magicString.original)) !== null) {
      allArr.push(arr)
      markArr.push([arr.index, arr.index + arr[0].length])
    }
    //  magicString.original.matchAll(regex)
    for (const regExpMatch of allArr) {
      let ast: ParseResult<babel.types.File> | null
      try {
        ast = babel.parseSync(regExpMatch[0], {
          sourceType: 'unambiguous',
        })

        ast
        && babel.traverse(ast, {
          StringLiteral: {
            enter(p) {
              const arr = sort(splitCode(p.node.value)).desc(x => x.length)

              for (const v of arr) {
                if (replaceMap.has(v)) {
                  ctx.addPreserveClass(v)
                }
              }
            },
          },
          TemplateElement: {
            enter(p) {
              const arr = sort(splitCode(p.node.value.raw)).desc(x => x.length)
              for (const v of arr) {
                if (replaceMap.has(v)) {
                  ctx.addPreserveClass(v)
                }
              }
            },
          },
        })
      }
      catch {
        continue
      }
    }
  }
  for (const [key, value] of replaceMap) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
    const regex = new RegExp(escapeStringRegexp(key), 'g')
    let arr: RegExpExecArray | null = null
    while ((arr = regex.exec(magicString.original)) !== null) {
      const start = arr.index
      const end = arr.index + arr[0].length
      let shouldUpdate = true
      for (const [ps, pe] of markArr) {
        if (between(start, ps, pe) || between(end, ps, pe)) {
          shouldUpdate = false
          break
        }
      }
      if (shouldUpdate) {
        magicString.update(start, end, value)
        markArr.push([start, end])
      }
    }
  }

  return magicString.toString()
}

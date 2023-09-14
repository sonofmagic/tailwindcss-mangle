import babel from '@babel/core'
import { declare } from '@babel/helper-plugin-utils'
import MagicString from 'magic-string'
import { splitCode } from '@tailwindcss-mangle/shared'
import { sort } from 'fast-sort'
import { jsStringEscape } from '@ast-core/escape'
import { parse, ParseResult } from '@babel/parser'
import traverse from '@babel/traverse'
import { getStringLiteralCalleeName, getTemplateElementCalleeName } from './utils'
import type { Context } from '@/ctx'

interface Options {
  replaceMap: Map<string, string>
  magicString: MagicString
  id: string
  ctx: Context
}

type HandleValueOptions = {
  raw: string
  path: babel.NodePath<babel.types.StringLiteral | babel.types.TemplateElement>
  offset: number
  escape: boolean
  preserve: boolean
} & Options

export function handleValue(options: HandleValueOptions) {
  const { ctx, id, path, magicString, raw, replaceMap, offset = 0, escape = false, preserve = false } = options
  const node = path.node
  let value = raw
  const arr = sort(splitCode(value)).desc((x) => x.length)

  for (const str of arr) {
    if (replaceMap.has(str)) {
      ctx.addToUsedBy(str, id)
      if (preserve) {
        ctx.addPreserveClass(str)
      }
      // replace
      const v = replaceMap.get(str)
      if (v) {
        value = value.replaceAll(str, v)
      }
    }
  }
  if (preserve) {
    return
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
  const { magicString, replaceMap, id, ctx } = options
  return {
    visitor: {
      StringLiteral: {
        enter(p) {
          const opts: HandleValueOptions = {
            ctx,
            id,
            magicString,
            path: p,
            raw: p.node.value,
            replaceMap,
            offset: 1,
            escape: true,
            preserve: false
          }
          const calleeName = getStringLiteralCalleeName(p)
          if (calleeName && ctx.isPreserveFunction(calleeName)) {
            opts.preserve = true
          }
          handleValue(opts)
        }
      },
      TemplateElement: {
        enter(p) {
          const opts: HandleValueOptions = {
            ctx,
            id,
            magicString,
            path: p,
            raw: p.node.value.raw,
            replaceMap,
            offset: 0,
            escape: false,
            preserve: false
          }
          const calleeName = getTemplateElementCalleeName(p)
          if (calleeName && ctx.isPreserveFunction(calleeName)) {
            opts.preserve = true
          }
          handleValue(opts)
        }
      }
    }
  }
})

interface IPreProcessJsOptions {
  code: string | MagicString
  replaceMap: Map<string, string>
  id: string
  ctx: Context
}

function transformSync(code: string, plugins: babel.PluginItem[] | null | undefined, filename: string | null | undefined) {
  babel.transformSync(code, {
    presets: [
      // ['@babel/preset-react', {}],
      [
        require('@babel/preset-typescript'),
        {
          allExtensions: true,
          isTSX: true
        }
      ]
    ],
    plugins,
    filename
  })
}

export function preProcessJs(options: IPreProcessJsOptions) {
  const { code, replaceMap, id, ctx } = options
  const magicString = typeof code === 'string' ? new MagicString(code) : code
  transformSync(
    magicString.original,
    [
      [
        JsPlugin,
        {
          magicString,
          replaceMap,
          id,
          ctx
        }
      ]
    ],
    id
  )

  return magicString.toString()
}

interface IPreProcessRawCodeOptions {
  code: string | MagicString
  replaceMap: Map<string, string>
  id: string
  ctx: Context
}

export function preProcessRawCode(options: IPreProcessRawCodeOptions) {
  const { code, replaceMap, ctx } = options
  const magicString = typeof code === 'string' ? new MagicString(code) : code
  for (const regex of ctx.preserveFunctionRegexs) {
    for (const regExpMatch of magicString.original.matchAll(regex)) {
      let ast: ParseResult<babel.types.File>
      try {
        ast = parse(regExpMatch[0], {
          sourceType: 'unambiguous'
        })
        traverse(ast, {
          StringLiteral: {
            enter(p) {
              const array = splitCode(p.node.value)
              for (const v of array) {
                if (replaceMap.has(v)) {
                  ctx.addPreserveClass(v)
                }
              }
            }
          },
          TemplateElement: {
            enter(p) {
              const array = splitCode(p.node.value.raw)
              for (const v of array) {
                if (replaceMap.has(v)) {
                  ctx.addPreserveClass(v)
                }
              }
            }
          }
        })
      } catch {
        continue
      }
    }
    // console.log(arr, regex.lastIndex)
  }
  for (const [key, value] of replaceMap) {
    if (!ctx.isPreserveClass(key)) {
      magicString.replaceAll(key, value)
    }
  }
  return magicString.toString()
  // for (const [key, value] of replaceMap) {
  //   code = code.replaceAll(key, value)
  // }
  // return code
}

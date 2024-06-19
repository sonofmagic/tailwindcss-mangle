import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'
import type { IHtmlHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'
import { jsHandler } from '@/js'

export function htmlHandler(raw: string | MagicString, options: IHtmlHandlerOptions) {
  const { ctx, isVue } = options
  const { replaceMap } = ctx
  const ms: MagicString = typeof raw === 'string' ? new MagicString(raw) : raw
  const parser = new Parser({
    onattribute(name, value) {
      if (name === 'class') {
        const arr = splitCode(value, {
          splitQuote: false,
        })
        let rawValue = value
        for (const v of arr) {
          if (replaceMap.has(v)) {
            rawValue = rawValue.replace(makeRegex(v), ctx.classGenerator.generateClassName(v).name)
          }
        }
        ms.update(parser.startIndex + name.length + 2, parser.endIndex - 1, rawValue)
      }
      if (isVue) {
        if (name === ':class') {
          const { code } = jsHandler(value, {
            ctx,
          })
          ms.update(parser.startIndex + name.length + 2, parser.endIndex - 1, code)
        }
      }
    },
  })
  parser.write(ms.original)
  parser.end()
  return ms.toString()
}

import { Parser } from 'htmlparser2'
import MagicString from 'magic-string'
import { makeRegex, splitCode } from '@/shared'
import type { IHandlerTransformResult, IHtmlHandlerOptions } from '@/types'

export function htmlHandler(raw: string | MagicString, options: IHtmlHandlerOptions): IHandlerTransformResult {
  const { ctx, id } = options
  const { replaceMap, classGenerator } = ctx
  const ms: MagicString = typeof raw === 'string' ? new MagicString(raw) : raw
  const parser = new Parser({
    onattribute(name, value) {
      if (name === 'class') {
        let needUpdate = false
        const arr = splitCode(value, {
          splitQuote: false,
        })
        let rawValue = value
        for (const v of arr) {
          if (replaceMap.has(v)) {
            const gen = classGenerator.generateClassName(v)
            rawValue = rawValue.replace(makeRegex(v), gen.name)
            ctx.addToUsedBy(v, id)
            needUpdate = true
          }
        }
        needUpdate && ms.update(parser.startIndex + name.length + 2, parser.endIndex - 1, rawValue)
      }
    },
  })
  parser.write(ms.original)
  parser.end()
  return {
    code: ms.toString(),
  }
}

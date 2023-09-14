import { parse, serialize } from 'parse5'
import { traverse } from '@parse5/tools'
import { IHtmlHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'
// const { traverse } = await import('@parse5/tools')
export function htmlHandler(rawSource: string, options: IHtmlHandlerOptions) {
  const { replaceMap, ctx } = options
  const fragment = parse(rawSource)
  traverse(fragment, {
    element(node) {
      const attribute = node.attrs.find((x) => x.name === 'class')
      if (attribute) {
        const array = splitCode(attribute.value, {
          splitQuote: false
        })
        for (const v of array) {
          if (replaceMap.has(v)) {
            attribute.value = attribute.value.replace(makeRegex(v), ctx.classGenerator.generateClassName(v).name)
          }
        }
      }
    }
  })
  return serialize(fragment)
}

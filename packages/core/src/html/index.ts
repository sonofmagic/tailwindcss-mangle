import { parse, serialize } from 'parse5'
import { traverse } from '@parse5/tools'
import { IHtmlHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'

export function htmlHandler(rawSource: string, options: IHtmlHandlerOptions) {
  const { runtimeSet, classGenerator } = options
  const fragment = parse(rawSource)
  traverse(fragment, {
    element(node, parent) {
      const attribute = node.attrs.find((x) => x.name === 'class')
      if (attribute) {
        const array = splitCode(attribute.value, {
          splitQuote: false
        })
        for (const v of array) {
          if (runtimeSet.has(v)) {
            attribute.value = attribute.value.replace(makeRegex(v), classGenerator.generateClassName(v).name)
          }
        }
      }
    }
  })
  return serialize(fragment)
}

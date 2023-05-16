import { parse, serialize } from 'parse5'
import { traverse } from '@parse5/tools'
import { IHtmlHandlerOptions } from '../types'
import { makeRegex, splitCode } from '../shared'

export function htmlHandler(rawSource: string, options: IHtmlHandlerOptions) {
  const { runtimeSet, classGenerator } = options
  const fragment = parse(rawSource)
  traverse(fragment, {
    element(node, parent) {
      const attr = node.attrs.find((x) => x.name === 'class')
      if (attr) {
        const arr = splitCode(attr.value, {
          splitQuote: false
        })
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]
          if (runtimeSet.has(v)) {
            attr.value = attr.value.replace(makeRegex(v), classGenerator.generateClassName(v).name)
          }
        }
      }
    }
  })
  return serialize(fragment)
}

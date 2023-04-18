import { parse, serialize } from 'parse5'
import { traverse } from '@parse5/tools'
import { IHandlerOptions } from '@/types'

export function htmlHandler(rawSource: string, options: IHandlerOptions) {
  const { runtimeSet, classGenerator } = options
  const fragment = parse(rawSource)
  traverse(fragment, {
    element(node, parent) {
      const attr = node.attrs.find((x) => x.name === 'class')
      if (attr) {
        const arr = attr.value.split(/\s/).filter((x) => x)
        attr.value = arr
          .map((x) => {
            if (runtimeSet.has(x)) {
              return classGenerator.generateClassName(x).name
            }
            return x
          })
          .join(' ')
      }
    }
  })
  return serialize(fragment)
}

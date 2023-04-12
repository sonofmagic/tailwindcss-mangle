import { parse, traverse, generate } from '../lib/babel'

import type { Node } from '@babel/types'
import type { TraverseOptions, IJsHandlerOptions } from '../types'
import { escapeStringRegexp } from '../utils'
import { splitCode } from './split'

export function jsHandler(rawSource: string, options: IJsHandlerOptions) {
  const ast = parse(rawSource)
  const set = options.set
  const clsGen = options.classGenerator
  // 这样搞会把原先所有的 children 含有相关的 也都转义了
  const topt: TraverseOptions<Node> = {
    StringLiteral: {
      enter(p) {
        const n = p.node
        const arr = splitCode(n.value) // .split(/\s/).filter((x) => x)
        let rawStr = n.value
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i]
          if (set.has(v)) {
            let ignoreFlag = false
            if (Array.isArray(n.leadingComments)) {
              ignoreFlag = n.leadingComments.findIndex((x) => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
            }

            if (!ignoreFlag) {
              rawStr = rawStr.replace(new RegExp(escapeStringRegexp(v), 'g'), clsGen.generateClassName(v).name)
            }
          }
        }
        n.value = rawStr
      }
    },
    noScope: true
  }

  traverse(ast, topt)

  return generate(ast)
}

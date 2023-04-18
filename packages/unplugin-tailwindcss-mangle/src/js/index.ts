import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

import type { Node } from '@babel/types'
import type { TraverseOptions, IHandlerOptions } from '../types'
import { escapeStringRegexp } from '../utils'
import { splitCode } from './split'

function getDefaultExportFromNamespaceIfPresent(n: any) {
  return n && Object.prototype.hasOwnProperty.call(n, 'default') ? n.default : n
}
const generate = getDefaultExportFromNamespaceIfPresent(_generate) as typeof _generate
const traverse = getDefaultExportFromNamespaceIfPresent(_traverse) as typeof _traverse

export function jsHandler(rawSource: string, options: IHandlerOptions) {
  const ast = parse(rawSource)
  const set = options.runtimeSet
  const clsGen = options.classGenerator

  const topt: TraverseOptions<Node> = {
    StringLiteral: {
      enter(p) {
        const n = p.node
        const arr = splitCode(n.value)
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

import _generate from '@babel/generator'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'

import type { Node, StringLiteral, TemplateElement } from '@babel/types'
import type { TraverseOptions, IHandlerOptions } from '../types'
import { escapeStringRegexp } from '../utils'
import { splitCode } from './split'

function getDefaultExportFromNamespaceIfPresent(n: any) {
  return n && Object.prototype.hasOwnProperty.call(n, 'default') ? n.default : n
}
const generate = getDefaultExportFromNamespaceIfPresent(_generate) as typeof _generate
const traverse = getDefaultExportFromNamespaceIfPresent(_traverse) as typeof _traverse

export function makeRegex(str: string) {
  return new RegExp('(?<=^|[\\s"])' + escapeStringRegexp(str), 'g')
}

export function handleValue(str: string, node: StringLiteral | TemplateElement, options: IHandlerOptions) {
  const set = options.runtimeSet
  const clsGen = options.classGenerator
  const arr = splitCode(str)
  let rawStr = str
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (set.has(v)) {
      let ignoreFlag = false
      if (Array.isArray(node.leadingComments)) {
        ignoreFlag = node.leadingComments.findIndex((x) => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
      }

      if (!ignoreFlag) {
        rawStr = rawStr.replace(makeRegex(v), clsGen.generateClassName(v).name)
      }
    }
  }
  return rawStr
}

export function jsHandler(rawSource: string, options: IHandlerOptions) {
  const ast = parse(rawSource)

  const topt: TraverseOptions<Node> = {
    StringLiteral: {
      enter(p) {
        const n = p.node
        n.value = handleValue(n.value, n, options)
      }
    },
    TemplateElement: {
      enter(p) {
        const n = p.node
        n.value.raw = handleValue(n.value.raw, n, options)
      }
    },
    noScope: true
  }

  traverse(ast, topt)

  return generate(ast)
}

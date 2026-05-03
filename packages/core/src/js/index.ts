import type { NodePath } from '@babel/traverse'
import type { Expression, Node, StringLiteral, TemplateElement } from '@babel/types'
import type { IHandlerTransformResult, IJsHandlerOptions } from '../types'
import { jsStringEscape } from '@ast-core/escape'
import { sort } from 'fast-sort'
import MagicString from 'magic-string'
import { parse, traverse } from '../babel'
import { ignoreIdentifier } from '../constants'
import { makeRegex, splitCode } from '../shared'

const classPropertyNames = new Set(['class', 'className', 'classNames', 'cls', 'staticClass'])
const htmlPropertyNames = new Set(['innerHTML', 'outerHTML'])
const classListMethodNames = new Set(['add', 'remove', 'toggle', 'replace'])
const htmlCalleeNames = new Set(['createStaticVNode'])

interface ClassAttributeState {
  quote?: '"' | '\''
}

function replaceClassTokens(raw: string, options: IJsHandlerOptions) {
  const { ctx, splitQuote = true, id } = options
  const { replaceMap, classGenerator: clsGen } = ctx
  const array = splitCode(raw, {
    splitQuote,
  })
  let rawString = raw
  let needUpdate = false

  for (const v of array) {
    if (replaceMap.has(v) && !ctx.isPreserveClass(v)) {
      const gen = clsGen.generateClassName(v)
      rawString = rawString.replace(makeRegex(v), gen.name)
      ctx.addToUsedBy(v, id)
      needUpdate = true
    }
  }

  return {
    rawString,
    needUpdate,
  }
}

function updateNodeValue(raw: string, rawString: string, node: StringLiteral | TemplateElement, ms: MagicString, offset: number, escape: boolean) {
  if (typeof node.start === 'number' && typeof node.end === 'number') {
    const start = node.start + offset
    const end = node.end - offset

    if (start < end && raw !== rawString) {
      ms.update(start, end, escape ? jsStringEscape(rawString) : rawString)
    }
  }
}

export function handleValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions, ms: MagicString, offset: number, escape: boolean) {
  let ignoreFlag = false
  if (Array.isArray(node.leadingComments)) {
    ignoreFlag = node.leadingComments.findIndex(x => x.value.includes('tw-mangle') && x.value.includes('ignore')) > -1
  }

  if (!ignoreFlag) {
    const { rawString, needUpdate } = replaceClassTokens(raw, options)
    if (needUpdate) {
      updateNodeValue(raw, rawString, node, ms, offset, escape)
      return rawString
    }
  }

  return raw
}

function preserveClassTokens(raw: string, options: IJsHandlerOptions) {
  const { ctx, splitQuote = true } = options
  const arr = sort(splitCode(raw, { splitQuote })).desc(x => x.length)

  for (const str of arr) {
    if (ctx.replaceMap.has(str)) {
      ctx.addPreserveClass(str)
    }
  }
}

function isIdentifierName(node: Node | null | undefined, name: string) {
  return node?.type === 'Identifier' && node.name === name
}

function getPropertyName(node: Node | null | undefined) {
  if (!node) {
    return
  }
  if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
    return node.name
  }
  if (node.type === 'StringLiteral') {
    return node.value
  }
}

function isClassPropertyName(name: string | undefined) {
  return typeof name === 'string' && classPropertyNames.has(name)
}

function isHtmlPropertyName(name: string | undefined) {
  return typeof name === 'string' && htmlPropertyNames.has(name)
}

function getMemberPropertyName(path: NodePath<Node>) {
  if (!path.isMemberExpression()) {
    return
  }
  return getPropertyName(path.node.property)
}

function getCalleeName(path: NodePath<Node>) {
  if (path.isIdentifier()) {
    return path.node.name
  }
  if (path.isMemberExpression()) {
    return getPropertyName(path.node.property)
  }
  if (path.isSequenceExpression()) {
    const expressions = path.get('expressions') as NodePath<Node>[]
    return getCalleeName(expressions[expressions.length - 1])
  }
}

function getCallCalleeName(path: NodePath<Node>) {
  return path.isCallExpression() ? getCalleeName(path.get('callee') as NodePath<Node>) : undefined
}

function isIgnoredTaggedTemplate(path: NodePath<Node>) {
  if (!path.isTaggedTemplateExpression()) {
    return false
  }
  return isIdentifierName(path.node.tag, ignoreIdentifier)
}

function collectPreserveClasses(path: NodePath<Node>, options: IJsHandlerOptions) {
  path.traverse({
    StringLiteral: {
      enter(p) {
        preserveClassTokens(p.node.value, options)
      },
    },
    TemplateElement: {
      enter(p) {
        preserveClassTokens(p.node.value.raw, options)
      },
    },
  })
}

function transformClassAttributeValue(raw: string, options: IJsHandlerOptions, state: ClassAttributeState = {}) {
  let cursor = 0
  let value = ''
  const nextState = state

  const appendClassValue = (segment: string) => {
    value += replaceClassTokens(segment, {
      ...options,
      splitQuote: false,
    }).rawString
  }

  while (cursor < raw.length) {
    if (nextState.quote) {
      const end = raw.indexOf(nextState.quote, cursor)
      if (end === -1) {
        appendClassValue(raw.slice(cursor))
        cursor = raw.length
      }
      else {
        appendClassValue(raw.slice(cursor, end))
        value += raw[end]
        nextState.quote = undefined
        cursor = end + 1
      }
      continue
    }

    const classAttrRE = /(?:^|[\s<])class\s*=\s*(["'])/g
    classAttrRE.lastIndex = cursor
    const match = classAttrRE.exec(raw)
    if (!match) {
      value += raw.slice(cursor)
      break
    }

    const valueStart = match.index + match[0].length
    const quote = match[1] as '"' | '\''
    value += raw.slice(cursor, valueStart)
    const end = raw.indexOf(quote, valueStart)
    if (end === -1) {
      appendClassValue(raw.slice(valueStart))
      nextState.quote = quote
      cursor = raw.length
    }
    else {
      appendClassValue(raw.slice(valueStart, end))
      value += raw[end]
      cursor = end + 1
    }
  }

  return {
    value,
    state: nextState,
  }
}

function handleHtmlValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions, ms: MagicString, offset: number, escape: boolean, state?: ClassAttributeState) {
  const { value } = transformClassAttributeValue(raw, options, state)
  updateNodeValue(raw, value, node, ms, offset, escape)
  return value
}

function handleStringLiteral(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString, mode: 'class' | 'html') {
  if (!path.isStringLiteral()) {
    return
  }

  if (
    typeof path.node.value === 'string'
    && path.isDirectiveLiteral?.()
    && path.node.value.startsWith('use ')
  ) {
    return
  }

  if (mode === 'html') {
    handleHtmlValue(path.node.value, path.node, options, ms, 1, true)
  }
  else {
    handleValue(path.node.value, path.node, options, ms, 1, true)
  }
}

function handleClassExpression(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (path.isStringLiteral()) {
    handleStringLiteral(path, options, ms, 'class')
    return
  }

  if (path.isTemplateLiteral()) {
    const quasis = path.get('quasis') as NodePath<TemplateElement>[]
    const expressions = path.get('expressions') as NodePath<Node>[]
    for (const [index, quasi] of quasis.entries()) {
      handleValue(quasi.node.value.raw, quasi.node, options, ms, 0, false)
      if (expressions[index]) {
        handleClassExpression(expressions[index], options, ms)
      }
    }
    return
  }

  if (path.isTaggedTemplateExpression()) {
    if (isIgnoredTaggedTemplate(path)) {
      collectPreserveClasses(path, options)
    }
    return
  }

  if (path.isConditionalExpression()) {
    handleClassExpression(path.get('consequent') as NodePath<Node>, options, ms)
    handleClassExpression(path.get('alternate') as NodePath<Node>, options, ms)
    return
  }

  if (path.isLogicalExpression() || path.isBinaryExpression({ operator: '+' })) {
    handleClassExpression(path.get('left') as NodePath<Node>, options, ms)
    handleClassExpression(path.get('right') as NodePath<Node>, options, ms)
    return
  }

  if (path.isArrayExpression()) {
    for (const element of path.get('elements') as NodePath<Node>[]) {
      if (element.node) {
        handleClassExpression(element, options, ms)
      }
    }
    return
  }

  if (path.isObjectExpression()) {
    for (const property of path.get('properties') as NodePath<Node>[]) {
      if (property.isObjectProperty()) {
        const key = property.get('key') as NodePath<Node>
        const value = property.get('value') as NodePath<Node>
        if (key.isStringLiteral()) {
          handleStringLiteral(key, options, ms, 'class')
        }
        handleClassExpression(value, options, ms)
      }
    }
    return
  }

  if (path.isCallExpression()) {
    const callee = path.get('callee')
    if (callee.isIdentifier() && options.ctx.isPreserveFunction(callee.node.name)) {
      collectPreserveClasses(path, options)
      return
    }

    for (const arg of path.get('arguments') as NodePath<Node>[]) {
      handleClassExpression(arg, options, ms)
    }
  }
}

function handleHtmlTemplateLiteral(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (!path.isTemplateLiteral()) {
    return
  }

  const state: ClassAttributeState = {}
  const quasis = path.get('quasis') as NodePath<TemplateElement>[]
  const expressions = path.get('expressions') as NodePath<Node>[]
  for (const [index, quasi] of quasis.entries()) {
    handleHtmlValue(quasi.node.value.raw, quasi.node, options, ms, 0, false, state)
    if (state.quote && expressions[index]) {
      handleClassExpression(expressions[index], options, ms)
    }
  }
}

function handleHtmlExpression(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (path.isStringLiteral()) {
    handleStringLiteral(path, options, ms, 'html')
  }
  else if (path.isTemplateLiteral()) {
    handleHtmlTemplateLiteral(path, options, ms)
  }
}

function handleClassListCall(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (!path.isCallExpression()) {
    return
  }
  const callee = path.get('callee')
  if (!callee.isMemberExpression()) {
    return
  }
  const propertyName = getMemberPropertyName(callee as NodePath<Node>)
  if (!classListMethodNames.has(propertyName ?? '')) {
    return
  }
  const object = callee.get('object')
  if (!object.isMemberExpression() || getMemberPropertyName(object as NodePath<Node>) !== 'classList') {
    return
  }

  const args = path.get('arguments') as NodePath<Node>[]
  const limit = propertyName === 'toggle' ? 1 : propertyName === 'replace' ? 2 : args.length
  for (const arg of args.slice(0, limit)) {
    handleClassExpression(arg, options, ms)
  }
}

function handleSetAttributeCall(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (!path.isCallExpression()) {
    return
  }
  const callee = path.get('callee')
  if (!callee.isMemberExpression() || getMemberPropertyName(callee as NodePath<Node>) !== 'setAttribute') {
    return
  }
  const args = path.get('arguments') as NodePath<Node>[]
  const attrName = args[0]
  if (attrName?.isStringLiteral() && attrName.node.value === 'class' && args[1]) {
    handleClassExpression(args[1], options, ms)
  }
}

function handleInsertAdjacentHtmlCall(path: NodePath<Node>, options: IJsHandlerOptions, ms: MagicString) {
  if (!path.isCallExpression()) {
    return
  }
  const callee = path.get('callee')
  if (!callee.isMemberExpression() || getMemberPropertyName(callee as NodePath<Node>) !== 'insertAdjacentHTML') {
    return
  }
  const args = path.get('arguments') as NodePath<Node>[]
  if (args[1]) {
    handleHtmlExpression(args[1], options, ms)
  }
}

export function jsHandler(rawSource: string | MagicString, options: IJsHandlerOptions): IHandlerTransformResult {
  const ms: MagicString = typeof rawSource === 'string' ? new MagicString(rawSource) : rawSource
  let ast
  try {
    ast = parse(ms.original, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript'],
    })
  }
  catch {
    return {
      code: ms.original,
    }
  }
  const { ctx } = options

  traverse(ast, {
    CallExpression: {
      enter(p) {
        const callee = p.get('callee')
        if (callee.isIdentifier() && ctx.isPreserveFunction(callee.node.name)) {
          collectPreserveClasses(p as NodePath<Node>, options)
        }
      },
    },
    TaggedTemplateExpression: {
      enter(p) {
        if (isIgnoredTaggedTemplate(p as NodePath<Node>)) {
          collectPreserveClasses(p as NodePath<Node>, options)
        }
      },
    },
  })

  traverse(ast, {
    CallExpression: {
      enter(p) {
        const calleeName = getCallCalleeName(p as NodePath<Node>) ?? ''
        if (ctx.isPreserveFunction(calleeName)) {
          p.skip()
          return
        }
        if (ctx.isClassFunction(calleeName)) {
          for (const arg of p.get('arguments') as NodePath<Node>[]) {
            handleClassExpression(arg, options, ms)
          }
          p.skip()
          return
        }

        handleSetAttributeCall(p as NodePath<Node>, options, ms)
        handleClassListCall(p as NodePath<Node>, options, ms)
        handleInsertAdjacentHtmlCall(p as NodePath<Node>, options, ms)
        if (calleeName === 'eval') {
          const firstArg = (p.get('arguments') as NodePath<Node>[])[0]
          if (firstArg?.isStringLiteral()) {
            const { code } = jsHandler(firstArg.node.value, options)
            updateNodeValue(firstArg.node.value, code, firstArg.node, ms, 1, true)
          }
        }

        if (htmlCalleeNames.has(calleeName)) {
          const firstArg = (p.get('arguments') as NodePath<Node>[])[0]
          if (firstArg) {
            handleHtmlExpression(firstArg, options, ms)
          }
        }
      },
    },
    AssignmentExpression: {
      enter(p) {
        const left = p.get('left') as NodePath<Node>
        const right = p.get('right') as NodePath<Node>
        if (left.isMemberExpression()) {
          const propertyName = getMemberPropertyName(left)
          if (isClassPropertyName(propertyName)) {
            handleClassExpression(right, options, ms)
          }
          else if (isHtmlPropertyName(propertyName)) {
            handleHtmlExpression(right, options, ms)
          }
        }
      },
    },
    VariableDeclarator: {
      enter(p) {
        const id = p.get('id') as NodePath<Node>
        const init = p.get('init') as NodePath<Node>
        if (id.isIdentifier() && isClassPropertyName(id.node.name) && init.node) {
          handleClassExpression(init, options, ms)
        }
      },
    },
    ObjectProperty: {
      enter(p) {
        const key = p.get('key') as NodePath<Node>
        const value = p.get('value') as NodePath<Node>
        if (isClassPropertyName(getPropertyName(key.node))) {
          handleClassExpression(value, options, ms)
        }
      },
    },
    JSXAttribute: {
      enter(p) {
        if (!isClassPropertyName(getPropertyName(p.node.name))) {
          return
        }
        const value = p.get('value') as NodePath<Node>
        if (value.isStringLiteral()) {
          handleStringLiteral(value, options, ms, 'class')
        }
        else if (value.isJSXExpressionContainer()) {
          const expression = value.get('expression') as NodePath<Expression>
          handleClassExpression(expression as NodePath<Node>, options, ms)
        }
      },
    },
  })

  return {
    code: ms.toString(),
    get map() {
      return ms.generateMap()
    },
  }
}

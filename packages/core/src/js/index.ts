import type { StringLiteral, TemplateElement } from '@babel/types'
import type MagicString from 'magic-string'
import type { IHandlerTransformResult, IJsHandlerOptions } from '../types'
import { escapeJsStringNative } from '@tailwindcss-mangle/native'
import { transformWithNative } from '../native'

/** Compatibility entry point for callers transforming an existing literal. */
export function handleValue(raw: string, node: StringLiteral | TemplateElement, options: IJsHandlerOptions, ms: MagicString, offset: number, escape: boolean) {
  if (node.leadingComments?.some(comment => comment.value.includes('tw-mangle') && comment.value.includes('ignore'))) {
    return raw
  }
  const value = transformWithNative(raw, { ...options, splitQuote: options.splitQuote ?? true }, 'text').code
  if (raw !== value && typeof node.start === 'number' && typeof node.end === 'number') {
    const start = node.start + offset
    const end = node.end - offset
    if (start < end) {
      ms.update(start, end, escape ? escapeJsStringNative(value) : value)
    }
  }
  return value
}

export function jsHandler(rawSource: string | MagicString, options: IJsHandlerOptions): IHandlerTransformResult {
  return transformWithNative(rawSource, options, 'js')
}

import type MagicString from 'magic-string'
import type { IHandlerTransformResult, IHtmlHandlerOptions } from '../types'
import { transformWithNative } from '../native'

export function htmlHandler(raw: string | MagicString, options: IHtmlHandlerOptions): IHandlerTransformResult {
  return transformWithNative(raw, options, 'html')
}

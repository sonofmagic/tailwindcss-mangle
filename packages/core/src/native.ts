import type { CallbackPlan, TransformResult } from '@tailwindcss-mangle/native'
import type { ICssHandlerOptions, IHandlerTransformResult, IJsHandlerOptions } from './types'
import { executeLiteralNative, planHtmlNative, planJsNative, planTextNative } from '@tailwindcss-mangle/native'
import MagicString from 'magic-string'
import { getNativeState } from './native-context'

export type NativeTransformKind = 'js' | 'html' | 'css' | 'text'

function executeCallbackPlan(plan: CallbackPlan, options: IJsHandlerOptions): TransformResult {
  const result: TransformResult = { edits: [], used: [], preserved: [], valid: plan.valid }
  if (!plan.valid) {
    return result
  }
  const { ctx, id } = options
  for (const event of plan.events) {
    if (event.kind === 'preserve' || (event.kind === 'call' && ctx.isPreserveFunction(event.raw))) {
      for (const original of event.values) {
        if (event.kind === 'preserve' || ctx.replaceMap.has(original)) {
          ctx.addPreserveClass(original)
          result.preserved.push(original)
        }
      }
    }
    else if (event.kind === 'literal') {
      // Capture the public references once per literal, as the previous adapter
      // did. Callbacks may mutate their contents before the next candidate.
      const { replaceMap, classGenerator } = ctx
      const replacements = []
      for (const original of event.values) {
        if (replaceMap.has(original)) {
          replacements.push({ original, replacement: classGenerator.generateClassName(original).name })
          ctx.addToUsedBy(original, id)
          result.used.push(original)
        }
      }
      const edit = executeLiteralNative(event, replacements)
      if (edit) {
        result.edits.push(edit)
      }
    }
  }
  result.edits.sort((left, right) => left.start - right.start)
  return result
}

export function nativeEdits(source: string, options: ICssHandlerOptions & IJsHandlerOptions, kind: NativeTransformKind): TransformResult {
  const { ctx } = options
  if (kind !== 'css' && ctx.classGenerator.opts.customGenerate
    && [...ctx.replaceMap.keys()].some(original => !ctx.classGenerator.newClassMap[original.replaceAll('\\', '')])) {
    const plan = kind === 'js'
      ? planJsNative(source, options.splitQuote ?? true)
      : kind === 'html'
        ? planHtmlNative(source)
        : planTextNative(source, options.splitQuote ?? false)
    return executeCallbackPlan(plan, options)
  }
  const state = getNativeState(ctx, kind === 'css' ? 'css' : 'code')
  const transform = () => {
    switch (kind) {
      case 'js':
        return state.native.transformJs(source, [...ctx.preserveFunctionSet], options.splitQuote ?? true)
      case 'html':
        return state.native.transformHtml(source)
      case 'css':
        return state.native.transformCss(source, options.ignoreVueScoped ?? true)
      case 'text':
        return state.native.transformText(source, options.splitQuote ?? false)
    }
  }
  let result = transform()
  if (!result.valid) {
    return result
  }
  if (kind !== 'css') {
    // Resolve public JS callbacks only for encountered classes and in encounter
    // order. Normal initialized contexts already have all generated names.
    const replacements = []
    for (const original of result.used) {
      const replacement = ctx.classGenerator.generateClassName(original).name
      ctx.addToUsedBy(original, options.id)
      if (state.names.get(original) !== replacement) {
        replacements.push({ original, replacement })
        state.names.set(original, replacement)
      }
    }
    if (replacements.length) {
      state.native.update(replacements)
      result = transform()
    }
  }
  for (const original of result.preserved) {
    ctx.addPreserveClass(original)
  }
  return result
}

export function transformWithNative(raw: string | MagicString, options: ICssHandlerOptions & IJsHandlerOptions, kind: NativeTransformKind): IHandlerTransformResult {
  const ms = typeof raw === 'string' ? new MagicString(raw) : raw
  if (!options.ctx.replaceMap) {
    return { code: ms.original }
  }
  const result = nativeEdits(ms.original, options, kind)
  if (!result.valid) {
    return { code: ms.original }
  }
  for (const edit of result.edits) {
    if (edit.start === edit.end) {
      ms.appendLeft(edit.start, edit.content)
    }
    else {
      ms.update(edit.start, edit.end, edit.content)
    }
  }
  return {
    code: ms.toString(),
    get map() {
      return ms.generateMap()
    },
  }
}

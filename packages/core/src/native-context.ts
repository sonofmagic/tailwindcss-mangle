import type { Context } from './ctx'
import { NativeContext } from '@tailwindcss-mangle/native'

interface NativeState {
  native: NativeContext
  names: Map<string, string>
}

const states = new WeakMap<Context, Partial<Record<'css' | 'code', NativeState>>>()

export function getNativeState(ctx: Context, kind: 'css' | 'code'): NativeState {
  let contexts = states.get(ctx)
  if (!contexts) {
    contexts = {}
    states.set(ctx, contexts)
  }
  let state = contexts[kind]
  // Context exposes ordinary mutable Maps and class records. Compare their
  // effective contents, including prototype Map calls and record replacement.
  const names = new Map<string, string>()
  let changed = !state || state.names.size !== ctx.replaceMap.size
  for (const [original, replacement] of ctx.replaceMap) {
    const name = kind === 'css'
      ? replacement
      : ctx.classGenerator.newClassMap[original.replaceAll('\\', '')]?.name ?? original
    names.set(original, name)
    changed ||= !state?.names.has(original) || state.names.get(original) !== name
  }
  if (!state || changed) {
    const native = state?.native ?? new NativeContext()
    native.reset(Array.from(names, ([original, replacement]) => ({ original, replacement })), [])
    state = { native, names }
    contexts[kind] = state
  }
  if (kind === 'css') {
    state.native.setPreserved([...ctx.preserveClassNamesSet])
  }
  return state
}

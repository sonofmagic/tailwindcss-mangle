import type { StringLiteral, TemplateElement } from '@babel/types'
import type { IHandlerTransformResult } from '@tailwindcss-mangle/core'
import type { NativeContext } from '@tailwindcss-mangle/native'
import {
  ClassGenerator,
  Context,
  cssHandler,
  handleValue,
  htmlHandler,
  jsHandler,
  svelteHandler,
  vueHandler,
} from '@tailwindcss-mangle/core'
import MagicString from 'magic-string'
import { expectError, expectType } from 'tsd'

// Consume the published declarations, including the constructor's value and
// instance sides. Re-exporting an external class through a local export-star
// barrel previously turned its generated declaration into a type-only alias.
const generator = new ClassGenerator({
  customGenerate(original) {
    expectType<string>(original)
    return 'generated'
  },
})
const ctx = new Context()
expectType<ClassGenerator>(generator)
expectType<ClassGenerator>(ctx.classGenerator)
expectType<string>(generator.generateClassName('p-1').name)
expectType<Set<string>>(ctx.classGenerator.generateClassName('p-1').usedBy)
expectType<Map<string, string>>(ctx.getReplaceMap())
expectType<NativeContext>(ctx.getNativeContext())
expectError(new ClassGenerator({ customGenerate: () => 42 }))

expectType<IHandlerTransformResult>(jsHandler('const name = "p-1"', { ctx, id: 'input.ts' }))
expectType<IHandlerTransformResult>(htmlHandler('<div class="p-1"/>', { ctx }))
expectType<Promise<IHandlerTransformResult>>(cssHandler('.p-1 {}', { ctx }))
expectType<Promise<IHandlerTransformResult>>(vueHandler('<template><div class="p-1"/></template>', { ctx }))
expectType<Promise<IHandlerTransformResult>>(svelteHandler('<div class="p-1"/>', { ctx }))
expectError(jsHandler('const name = "p-1"', { ctx, splitQuote: 'true' }))

declare const literal: StringLiteral
declare const template: TemplateElement
const text = new MagicString('"p-1"')
expectType<string>(handleValue('p-1', literal, { ctx }, text, 1, true))
expectType<string>(handleValue('p-1', template, { ctx }, text, 0, false))

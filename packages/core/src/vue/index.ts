import { parse as parseVue } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import type { IVueHandlerOptions } from '@/types'
import { parse as parseJs, traverse } from '@/babel'

export function vueHandler(raw: string | MagicString, options: IVueHandlerOptions) {
  const { ctx } = options
  const ms: MagicString = typeof raw === 'string' ? new MagicString(raw) : raw
  const { descriptor } = parseVue(ms.original)
  const { template, scriptSetup, script } = descriptor
  // console.log(template, scriptSetup, script)
  if (scriptSetup) {
    const ast = parseJs(scriptSetup.content, {
      sourceType: 'module',
      plugins: ['typescript'],
    })

    traverse(ast, {
      StringLiteral: {
        enter(p) {

        },
      },
    })
  }
  if (script) {
    parseJs(script.content, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
  }

  return ms.toString()
}

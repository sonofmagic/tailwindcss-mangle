import { parse as parseVue } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import type { IVueHandlerOptions } from '@/types'
import { jsHandler } from '@/js'
import { htmlHandler } from '@/html'

export function vueHandler(raw: string | MagicString, options: IVueHandlerOptions) {
  const { ctx } = options
  const ms: MagicString = typeof raw === 'string' ? new MagicString(raw) : raw
  const { descriptor } = parseVue(ms.original)
  const { template, scriptSetup, script } = descriptor
  if (template) {
    const code = htmlHandler(template.content, { ctx, isVue: true })
    ms.update(template.loc.start.offset, template.loc.end.offset, code)
  }
  if (script) {
    const x = jsHandler(script.content, { ctx })
    ms.update(script.loc.start.offset, script.loc.end.offset, x.code)
  }
  if (scriptSetup) {
    const x = jsHandler(scriptSetup.content, { ctx })
    ms.update(scriptSetup.loc.start.offset, scriptSetup.loc.end.offset, x.code)
  }

  return ms.toString()
}

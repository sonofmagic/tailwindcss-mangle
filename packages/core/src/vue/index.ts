import type { IHandlerTransformResult, IJsHandlerOptions } from '../types'
import { parse } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { cssHandler } from '../css'
import { jsHandler } from '../js'
import { nativeEdits } from '../native'

interface IVueHandlerOptions extends IJsHandlerOptions {
  preserveScoped?: boolean
}

async function processTemplate(
  template: any,
  ms: MagicString,
  ctx: any,
  id?: string,
): Promise<void> {
  const start = template.loc.start.offset
  const content = ms.original.slice(start, template.loc.end.offset)
  const options = id === undefined ? { ctx } : { ctx, id }
  for (const edit of nativeEdits(content, options, 'html').edits) {
    ms.update(start + edit.start, start + edit.end, edit.content)
  }
}

async function processScript(
  descriptor: any,
  ms: MagicString,
  ctx: any,
  id?: string,
): Promise<void> {
  const script = descriptor.scriptSetup || descriptor.script
  if (!script) {
    return
  }

  const scriptContent = ms.original.slice(
    script.loc.start.offset,
    script.loc.end.offset,
  )

  const jsHandlerOptions = id === undefined ? { ctx } : { ctx, id }
  const result = jsHandler(scriptContent, jsHandlerOptions)
  if (result.code !== scriptContent) {
    ms.update(
      script.loc.start.offset,
      script.loc.end.offset,
      result.code,
    )
  }
}

async function processStyles(
  styles: any[],
  ms: MagicString,
  ctx: any,
  id?: string,
): Promise<void> {
  for (const style of styles) {
    const styleContent = ms.original.slice(
      style.loc.start.offset,
      style.loc.end.offset,
    )

    const cssHandlerOptions = id === undefined
      ? { ctx, ignoreVueScoped: style.scoped }
      : { ctx, id, ignoreVueScoped: style.scoped }
    const result = await cssHandler(styleContent, cssHandlerOptions)

    if (result.code !== styleContent) {
      ms.update(
        style.loc.start.offset,
        style.loc.end.offset,
        result.code,
      )
    }
  }
}

export async function vueHandler(
  rawSource: string,
  options: IVueHandlerOptions,
): Promise<IHandlerTransformResult> {
  const { ctx, id } = options
  const ms = new MagicString(rawSource)

  try {
    const { descriptor } = parse(rawSource, {
      filename: id || 'unknown.vue',
    })

    // Process template section
    if (descriptor.template) {
      await processTemplate(descriptor.template, ms, ctx, id)
    }

    // Process script section
    if (descriptor.script || descriptor.scriptSetup) {
      await processScript(descriptor, ms, ctx, id)
    }

    // Process style sections
    if (descriptor.styles && descriptor.styles.length > 0) {
      await processStyles(descriptor.styles, ms, ctx, id)
    }

    return {
      code: ms.toString(),
      get map() {
        return ms.generateMap()
      },
    }
  }
  catch {
    // Fallback to jsHandler if Vue parsing fails
    return jsHandler(rawSource, options)
  }
}

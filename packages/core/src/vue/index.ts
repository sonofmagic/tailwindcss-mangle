import type { IHandlerTransformResult, IJsHandlerOptions } from '../types'
import { compileTemplate, parse } from '@vue/compiler-sfc'
import MagicString from 'magic-string'
import { cssHandler } from '../css'
import { jsHandler } from '../js'
import { makeRegex, splitCode } from '../shared'

interface IVueHandlerOptions extends IJsHandlerOptions {
  preserveScoped?: boolean
}

async function processTemplate(
  template: any,
  ms: MagicString,
  ctx: any,
  id?: string,
): Promise<void> {
  const { replaceMap, classGenerator } = ctx

  if (!template.ast) {
    try {
      compileTemplate({
        source: template.content,
        filename: id || 'unknown.vue',
        id: `${id || 'unknown'}?template`,
      })
      // If compilation succeeds, process the original template content
      // using a string-based approach for class attributes
    }
    catch {
      return
    }
  }

  // Process static class attributes in template
  const classAttrRegex = /\sclass\s*=\s*["']([^"']+)["']/g

  // We need to search within the template section
  const templateStart = template.loc.start.offset
  const templateEnd = template.loc.end.offset
  const templateContent = ms.original.slice(templateStart, templateEnd)

  const replacements: Array<{ start: number, end: number, value: string }> = []

  for (const match of templateContent.matchAll(classAttrRegex)) {
    const fullMatch = match[0]
    const classValue = match[1]
    if (classValue === undefined) {
      continue
    }
    const offset = match.index

    const arr = splitCode(classValue, { splitQuote: false })
    let newValue = classValue
    let needUpdate = false

    for (const v of arr) {
      if (replaceMap.has(v)) {
        const gen = classGenerator.generateClassName(v)
        newValue = newValue.replace(makeRegex(v), gen.name)
        if (id) {
          ctx.addToUsedBy(v, id)
        }
        needUpdate = true
      }
    }

    if (needUpdate) {
      const classValueStart = fullMatch.indexOf(classValue)
      replacements.push({
        start: templateStart + offset + classValueStart,
        end: templateStart + offset + classValueStart + classValue.length,
        value: newValue,
      })
    }
  }

  // Apply all replacements
  for (const replacement of replacements) {
    ms.update(replacement.start, replacement.end, replacement.value)
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

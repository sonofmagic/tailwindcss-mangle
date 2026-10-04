import type { ICssHandlerOptions, IHandlerTransformResult } from '../types'
import { Buffer } from 'node:buffer'
import remapping from '@jridgewell/remapping'
import { cssSourceMapAnnotationsNative } from '@tailwindcss-mangle/native'
import MagicString from 'magic-string'
import { basename, dirname, isAbsolute, join, relative } from 'pathe'
import postcss from 'postcss'
import { nativeEdits, transformWithNative } from '../native'

export async function cssHandler(rawSource: string, options: ICssHandlerOptions): Promise<IHandlerTransformResult> {
  try {
    // PostCSS Input preserves its existing inline/external previous-map loading
    // contract. Selector parsing and transformation remain in the Rust kernel.
    const input = new postcss.Input(rawSource, options.id ? { from: options.id } : {})
    const previous = input.map
    if (!previous?.text) {
      return transformWithNative(rawSource, options, 'css')
    }
    const result = nativeEdits(rawSource, options, 'css')
    if (!result.valid) {
      return { code: rawSource }
    }
    const ms = new MagicString(rawSource)
    for (const edit of result.edits) {
      if (edit.start === edit.end) {
        ms.appendLeft(edit.start, edit.content)
      }
      else {
        ms.update(edit.start, edit.end, edit.content)
      }
    }
    for (const annotation of cssSourceMapAnnotationsNative(rawSource)) {
      ms.remove(annotation.start, annotation.end)
    }
    const generated = ms.generateMap({ source: input.from, file: options.id ?? input.from, includeContent: true, hires: true })
    const previousMap = JSON.parse(previous.text.replace(/^\)\]\}'[^\n]*\n/, ''))
    const mapRoot = relative(dirname(input.from), previous.root ?? dirname(input.from))
    const map = remapping([generated, previousMap], (source, context) => {
      // External map sources resolve from the map's own directory. Preserve
      // URLs and absolute paths instead of treating them as filesystem paths.
      if (!isAbsolute(source) && !/^[a-z][a-z+.-]*:/i.test(source)) {
        context.source = join(mapRoot, source)
      }
      return null
    })
    const annotation = previous.inline
      ? `data:application/json;base64,${Buffer.from(map.toString()).toString('base64')}`
      : `${basename(options.id ?? input.from)}.map`
    const code = `${ms.toString().trimEnd()}\n/*# sourceMappingURL=${annotation} */`
    return { code, map: previous.inline ? undefined : map.toString() }
  }
  catch {
    return { code: rawSource }
  }
}

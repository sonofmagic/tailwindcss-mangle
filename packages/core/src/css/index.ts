import type { ICssHandlerOptions, IHandlerTransformResult } from '../types'
import postcss from 'postcss'
import { transformSelectorPostcssPlugin } from './plugins'

export async function cssHandler(rawSource: string, options: ICssHandlerOptions): Promise<IHandlerTransformResult> {
  const acceptedPlugins = [transformSelectorPostcssPlugin(options)]
  const { id } = options
  const processOptions = id === undefined ? {} : { from: id, to: id }
  try {
    const { css: code, map } = await postcss(acceptedPlugins).process(rawSource, processOptions)
    return {
      code,
      // @ts-ignore
      map,
    }
  }
  catch (_error) {
    return {
      code: rawSource,
    }
  }
}

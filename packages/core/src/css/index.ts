import postcss from 'postcss'
import type { ICssHandlerOptions } from '../types'
import { transformSelectorPostcssPlugin } from './plugins'

export function cssHandler(rawSource: string, options: ICssHandlerOptions) {
  const acceptedPlugins = [transformSelectorPostcssPlugin(options)]
  const { id } = options
  return postcss(acceptedPlugins).process(rawSource, {
    from: id,
    to: id,
  })
}

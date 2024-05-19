import postcss from 'postcss'
import type { ICssHandlerOptions } from '../types'
import { transformSelectorPostcssPlugin } from './plugins'

export function cssHandler(rawSource: string, options: ICssHandlerOptions) {
  const acceptedPlugins = [transformSelectorPostcssPlugin(options)]
  const { file } = options
  return postcss(acceptedPlugins).process(rawSource, {
    from: file,
    to: file,
  })
}

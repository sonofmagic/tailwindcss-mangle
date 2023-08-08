import postcss from 'postcss'
import { ICssHandlerOptions } from '../types'
import { postcssMangleTailwindcssPlugin } from './plugins'

export function cssHandler(rawSource: string, options: ICssHandlerOptions) {
  const acceptedPlugins = [postcssMangleTailwindcssPlugin(options)]
  return postcss(acceptedPlugins).process(rawSource).css
}

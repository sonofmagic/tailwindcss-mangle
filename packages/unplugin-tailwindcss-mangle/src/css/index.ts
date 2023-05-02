import postcss from 'postcss'
import { postcssMangleTailwindcssPlugin } from './plugins'
import { ICssHandlerOptions } from '@/types'

export function cssHandler(rawSource: string, options: ICssHandlerOptions) {
  const acceptedPlugins = [postcssMangleTailwindcssPlugin(options)]
  return postcss(acceptedPlugins).process(rawSource).css
}

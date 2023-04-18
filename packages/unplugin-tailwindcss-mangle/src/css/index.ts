import postcss from 'postcss'
import { postcssMangleTailwindcssPlugin } from './plugins'
import { IHandlerOptions } from '@/types'

export function cssHandler(rawSource: string, options: IHandlerOptions) {
  return postcss([
    postcssMangleTailwindcssPlugin({
      newClassMap: options.classGenerator.newClassMap
    })
  ]).process(rawSource).css
}

import * as webpack from 'webpack'
import ClassGenerator from '../classGenerator'
import { cssHandler } from '../css'

export default function cssloader(
  this: webpack.LoaderContext<{
    classGenerator: ClassGenerator
    getCachedClassSet: (() => Set<string>) | undefined
  }>,
  content: string
) {
  this.cacheable && this.cacheable()
  const opt = this.getOptions()
  if (opt.getCachedClassSet) {
    const runtimeSet = opt.getCachedClassSet()
    return cssHandler(content, {
      classGenerator: opt.classGenerator,
      runtimeSet,
      scene: 'loader'
    })
  }

  return content
}

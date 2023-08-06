import * as webpack from 'webpack'
import { cssHandler, ClassGenerator } from 'tailwindcss-mangle-core'

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

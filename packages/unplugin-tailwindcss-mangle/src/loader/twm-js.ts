import * as webpack from 'webpack'
import ClassGenerator from '../classGenerator'
import { jsHandler } from '../js'

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
    const code = jsHandler(content, {
      runtimeSet,
      classGenerator: opt.classGenerator
    }).code
    if (code) {
      return code
    }
  }

  return content
}

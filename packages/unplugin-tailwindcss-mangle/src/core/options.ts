import type { Options, ClassMapOutputOptions } from '@/types'
import { ClassGenerator } from '@tailwindcss-mangle/core'
import type { IHtmlHandlerOptions, IJsHandlerOptions, ICssHandlerOptions } from '@tailwindcss-mangle/core'
import { createGlobMatcher, defaultMangleClassFilter } from '@/utils'
import fs from 'node:fs'
export function getOptions(options: Options | undefined = {}) {
  const includeMatcher = createGlobMatcher(options.include, true)
  const excludeMatcher = createGlobMatcher(options.exclude, false)
  const currentMangleClassFilter = options.mangleClassFilter ?? defaultMangleClassFilter
  function isInclude(file: string) {
    return includeMatcher(file) && !excludeMatcher(file)
  }

  const classSet: Set<string> = new Set()
  if (options.classListPath) {
    const rawClassList = fs.readFileSync(options.classListPath, 'utf8')
    const classList = JSON.parse(rawClassList) as string[]
    for (const className of classList) {
      if (currentMangleClassFilter(className)) {
        classSet.add(className)
      }
    }
  }

  const classMapOutputOptions: ClassMapOutputOptions = {
    filename: 'classMap.json'
  }

  if (typeof options.classMapOutput === 'object') {
    Object.assign(classMapOutputOptions, options.classMapOutput)
  }

  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)
  function getCachedClassSet() {
    return classSet
  }

  return {
    getCachedClassSet,
    classGenerator,
    includeMatcher,
    excludeMatcher,
    isInclude,
    classMapOutputOptions,
    jsHandlerOptions: <IJsHandlerOptions>(options.jsHandlerOptions ?? {}),
    htmlHandlerOptions: <IHtmlHandlerOptions>(options.htmlHandlerOptions ?? {}),
    cssHandlerOptions: <ICssHandlerOptions>(options.cssHandlerOptions ?? {})
  }
}

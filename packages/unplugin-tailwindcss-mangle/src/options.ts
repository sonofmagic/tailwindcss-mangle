import type { Options } from './types'
import { getClassCacheSet } from 'tailwindcss-patch'
import ClassGenerator from './classGenerator'
import { createGlobMatcher } from './utils'

export function getOptions(options: Options | undefined = {}) {
  const includeMatcher = createGlobMatcher(options.include, true)
  const excludeMatcher = createGlobMatcher(options.exclude, false)

  function isInclude(file: string) {
    return includeMatcher(file) && !excludeMatcher(file)
  }

  const isMangleClass = (className: string) => {
    // ignore className like 'filter','container'
    // it may be dangerous to mangle/rename all StringLiteral , so use /-/ test for only those with /-/ like:
    // bg-[#123456] w-1 etc...
    return /[-:]/.test(className)
  }
  let classSet: Set<string>
  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)
  function getCachedClassSet() {
    const set = getClassCacheSet()
    set.forEach((c) => {
      if (!isMangleClass(c)) {
        set.delete(c)
      }
    })

    classSet = set

    return classSet
  }

  return {
    getCachedClassSet,
    classGenerator,
    includeMatcher,
    excludeMatcher,
    isInclude
  }
}

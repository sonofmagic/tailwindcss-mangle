import type { Options, ClassSetOutputOptions, ClassMapOutputOptions } from './types'
import { TailwindcssPatcher } from 'tailwindcss-patch'
import ClassGenerator from './classGenerator'
import { createGlobMatcher, isMangleClass, cacheDump } from './utils'

export function getOptions(options: Options | undefined = {}) {
  const includeMatcher = createGlobMatcher(options.include, true)
  const excludeMatcher = createGlobMatcher(options.exclude, false)

  function isInclude(file: string) {
    return includeMatcher(file) && !excludeMatcher(file)
  }

  let classSet: Set<string>
  const twPatcher = new TailwindcssPatcher()
  const classSetOutputOptions: ClassSetOutputOptions = {
    filename: 'classSet.json',
    type: 'partial'
  }

  const classMapOutputOptions: ClassMapOutputOptions = {
    filename: 'classMap.json'
  }

  if (typeof options.classSetOutput === 'object') {
    Object.assign(classSetOutputOptions, options.classSetOutput)
  }
  if (typeof options.classMapOutput === 'object') {
    Object.assign(classMapOutputOptions, options.classMapOutput)
  }

  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)
  function getCachedClassSet() {
    const set = twPatcher.getClassSet()
    const isOutput = set.size && options.classSetOutput
    if (isOutput && classSetOutputOptions.type === 'all') {
      cacheDump(classSetOutputOptions.filename, set, classSetOutputOptions.dir)
    }
    set.forEach((c) => {
      if (!isMangleClass(c)) {
        set.delete(c)
      }
    })
    if (isOutput && classSetOutputOptions.type === 'partial') {
      cacheDump(classSetOutputOptions.filename, set, classSetOutputOptions.dir)
    }

    classSet = set

    return classSet
  }

  return {
    getCachedClassSet,
    classGenerator,
    includeMatcher,
    excludeMatcher,
    isInclude,
    classSetOutputOptions,
    classMapOutputOptions,
    twPatcher
  }
}

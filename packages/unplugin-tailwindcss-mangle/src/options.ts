import type { Options, ClassSetOutputOptions } from './types'
import { getClassCacheSet } from 'tailwindcss-patch'
import ClassGenerator from './classGenerator'
import { createGlobMatcher } from './utils'
import fs from 'fs'
import path from 'path'
import { pluginName } from './constants'

export function mkCacheDirectory(cwd = process.cwd()) {
  const cacheDirectory = path.resolve(cwd, 'node_modules', '.cache', pluginName)

  const exists = fs.existsSync(cacheDirectory)
  if (!exists) {
    fs.mkdirSync(cacheDirectory, {
      recursive: true
    })
  }
  return cacheDirectory
}

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

  const classSetOutputOptions: ClassSetOutputOptions = {
    filename: path.resolve(process.cwd(), 'node_modules', '.cache', pluginName, 'classSet.json'),
    type: 'partial'
  }
  if (typeof options.classSetOutput === 'object') {
    Object.assign(classSetOutputOptions, options.classSetOutput)
  }

  function writeClassSetJson(set: Set<string>) {
    mkCacheDirectory()
    fs.writeFileSync(classSetOutputOptions.filename, JSON.stringify(Array.from(set), null, 2), 'utf-8')
  }
  // let cached: boolean
  const classGenerator = new ClassGenerator(options.classGenerator)
  function getCachedClassSet() {
    const set = getClassCacheSet()
    if (set.size && options.classSetOutput && classSetOutputOptions.type === 'all') {
      writeClassSetJson(set)
    }
    set.forEach((c) => {
      if (!isMangleClass(c)) {
        set.delete(c)
      }
    })
    if (set.size && options.classSetOutput && classSetOutputOptions.type === 'partial') {
      writeClassSetJson(set)
    }

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

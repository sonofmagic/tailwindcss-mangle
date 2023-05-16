import micromatch from 'micromatch'
import fs from 'fs'
import path from 'path'

import { pluginName } from './constants'
const { isMatch } = micromatch

export const isMangleClass = (className: string) => {
  // ignore className like 'filter','container'
  // it may be dangerous to mangle/rename all StringLiteral , so use /-/ test for only those with /-/ like:
  // bg-[#123456] w-1 etc...
  return /[-:]/.test(className)
}

export function groupBy<T>(arr: T[], cb: (arg: T) => string): Record<string, T[]> {
  if (!Array.isArray(arr)) {
    throw new Error('expected an array for first argument')
  }

  if (typeof cb !== 'function') {
    throw new Error('expected a function for second argument')
  }

  const result: Record<string, T[]> = {}
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    const bucketCategory = cb(item)
    const bucket = result[bucketCategory]

    if (!Array.isArray(bucket)) {
      result[bucketCategory] = [item]
    } else {
      result[bucketCategory].push(item)
    }
  }

  return result
}

export function getGroupedEntries<T>(
  entries: [string, T][],
  options = {
    cssMatcher(file: string) {
      return /\.css$/.test(file)
    },
    htmlMatcher(file: string) {
      return /\.html?$/.test(file)
    },
    jsMatcher(file: string) {
      return /\.[cm]?js$/.test(file)
    }
  }
) {
  const { cssMatcher, htmlMatcher, jsMatcher } = options
  const groupedEntries = groupBy(entries, ([file]) => {
    if (cssMatcher(file)) {
      return 'css'
    } else if (htmlMatcher(file)) {
      return 'html'
    } else if (jsMatcher(file)) {
      return 'js'
    } else {
      return 'other'
    }
  })
  if (!groupedEntries.css) {
    groupedEntries.css = []
  }
  if (!groupedEntries.html) {
    groupedEntries.html = []
  }
  if (!groupedEntries.js) {
    groupedEntries.js = []
  }
  if (!groupedEntries.other) {
    groupedEntries.other = []
  }
  return groupedEntries as Record<'css' | 'html' | 'js' | 'other', [string, T][]>
}

export function isRegexp(value: unknown) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

export function isMap(value: unknown) {
  return Object.prototype.toString.call(value) === '[object Map]'
}

export function createGlobMatcher(pattern: string | string[] | undefined, fallbackValue: boolean = false) {
  if (typeof pattern === 'undefined') {
    return function (file: string) {
      return fallbackValue
    }
  }
  return function (file: string) {
    return isMatch(file, pattern)
  }
}

export function getCacheDir(basedir = process.cwd()) {
  return path.resolve(basedir, 'node_modules/.cache', pluginName)
}

export function mkCacheDirectory(cwd = process.cwd()) {
  const cacheDirectory = getCacheDir(cwd)

  const exists = fs.existsSync(cacheDirectory)
  if (!exists) {
    fs.mkdirSync(cacheDirectory, {
      recursive: true
    })
  }
  return cacheDirectory
}

export function cacheDump(filename: string, data: any[] | Set<any>, basedir?: string) {
  try {
    const dir = mkCacheDirectory(basedir)
    fs.writeFileSync(path.resolve(dir, filename), JSON.stringify(Array.from(data), null, 2), 'utf-8')
  } catch (error) {
    console.log(error)
  }
}

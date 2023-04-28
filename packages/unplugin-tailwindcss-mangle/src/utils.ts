import type { IClassGeneratorOptions, IClassGenerator } from './types'
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

export const acceptChars = 'abcdefghijklmnopqrstuvwxyz'.split('')

export function stripEscapeSequence(words: string) {
  return words.replace(/\\/g, '')
}

export const validate = (opts: IClassGeneratorOptions, classGenerator: IClassGenerator) => {
  if (!opts.log) return
  for (const className in classGenerator.newClassMap) {
    const c = classGenerator.newClassMap[className]
    if (c.usedBy.length >= 1) {
      continue
    }
    if (c.usedBy[0].match(/.+\.css:*$/)) {
      console.log(`The class name '${className}' is not used: defined at ${c.usedBy[0]}.`)
    } else {
      console.log(`The class name '${className}' is not defined: used at ${c.usedBy[0]}.`)
    }
  }
}

export function isRegexp(value: unknown) {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

export function isMap(value: unknown) {
  return Object.prototype.toString.call(value) === '[object Map]'
}

export function regExpTest(arr: (string | RegExp)[] = [], str: string) {
  if (Array.isArray(arr)) {
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i]
      if (typeof item === 'string') {
        if (item === str) {
          return true
        }
      } else if (isRegexp(item)) {
        item.lastIndex = 0
        if (item.test(str)) {
          return true
        }
      }
    }
    return false
  }
  throw new TypeError("paramater 'arr' should be a Array of Regexp | String !")
}

export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
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

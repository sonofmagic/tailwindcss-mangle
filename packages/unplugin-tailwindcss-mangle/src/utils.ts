import type { IMangleOptions, IClassGenerator } from './types'

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
      return /\.js$/.test(file)
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
  return groupedEntries as Record<'css' | 'html' | 'js' | 'other', [string, T][]>
}

export const acceptPrefix = 'abcdefghijklmnopqrstuvwxyz_'.split('')

export const acceptChars = 'abcdefghijklmnopqrstuvwxyz_-0123456789'.split('')

export function stripEscapeSequence(words: string) {
  return words.replace(/\\/g, '')
}

export const validate = (opts: IMangleOptions, classGenerator: IClassGenerator) => {
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
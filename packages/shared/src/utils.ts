import type { IClassGeneratorOptions, IClassGenerator } from './types'

export const defaultMangleClassFilter = (className: string) => {
  // ignore className like 'filter','container'
  // it may be dangerous to mangle/rename all StringLiteral , so use /-/ test for only those with /-/ like:
  // bg-[#123456] w-1 etc...
  return /[:-]/.test(className)
}

export function groupBy<T>(arr: T[], cb: (arg: T) => string): Record<string, T[]> {
  if (!Array.isArray(arr)) {
    throw new TypeError('expected an array for first argument')
  }

  if (typeof cb !== 'function') {
    throw new TypeError('expected a function for second argument')
  }

  const result: Record<string, T[]> = {}
  for (const item of arr) {
    const bucketCategory = cb(item)
    const bucket = result[bucketCategory]

    if (Array.isArray(bucket)) {
      result[bucketCategory].push(item)
    } else {
      result[bucketCategory] = [item]
    }
  }

  return result
}

export const acceptChars = [...'abcdefghijklmnopqrstuvwxyz']

export function stripEscapeSequence(words: string) {
  return words.replaceAll('\\', '')
}

export const validate = (opts: IClassGeneratorOptions, classGenerator: IClassGenerator) => {
  if (!opts.log) return
  for (const className in classGenerator.newClassMap) {
    const c = classGenerator.newClassMap[className]
    if (c.usedBy.length > 0) {
      continue
    }
    if (/.+\.css:*$/.test(c.usedBy[0])) {
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
    for (const item of arr) {
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

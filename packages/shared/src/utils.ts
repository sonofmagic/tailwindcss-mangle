export const preserveClassNames = [
  // https://tailwindcss.com/docs/transition-timing-function start
  // https://github.com/sonofmagic/tailwindcss-mangle/issues/21
  'ease-out',
  'ease-linear',
  'ease-in',
  'ease-in-out'
  // https://tailwindcss.com/docs/transition-timing-function end
]

// eslint-disable-next-line unicorn/no-array-reduce
const preserveClassNamesMap = preserveClassNames.reduce<Record<(typeof preserveClassNames)[number], true>>((acc, cur) => {
  acc[cur] = true
  return acc
}, {})

export const defaultMangleClassFilter = (className: string) => {
  if (preserveClassNamesMap[className]) {
    return false
  }
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

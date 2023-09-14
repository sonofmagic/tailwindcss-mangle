import micromatch from 'micromatch'

const { isMatch } = micromatch

export function createGlobMatcher(pattern: string | string[] | undefined, fallbackValue: boolean = false) {
  if (pattern === undefined) {
    return function () {
      return fallbackValue
    }
  }
  return function (file: string) {
    return isMatch(file, pattern)
  }
}

export { defaultMangleClassFilter, isMap, isRegexp } from '@tailwindcss-mangle/shared'

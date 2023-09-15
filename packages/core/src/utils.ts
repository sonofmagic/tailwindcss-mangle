import micromatch from 'micromatch'

const { isMatch } = micromatch

export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&').replaceAll('-', '\\x2d')
}

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

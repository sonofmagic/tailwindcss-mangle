export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&').replaceAll('-', '\\x2d')
}

export { defaultMangleClassFilter, isMap, isRegexp } from '@tailwindcss-mangle/shared'

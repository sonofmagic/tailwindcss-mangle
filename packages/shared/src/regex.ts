export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

export function makeRegex(str: string) {
  return new RegExp('(?<=^|[\\s"])' + escapeStringRegexp(str), 'g')
}

export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&').replaceAll('-', '\\x2d')
}

export function makeRegex(
  str: string,
  options: {
    exact: boolean
  } = {
    exact: true,
  },
) {
  return new RegExp(`(?<=^|[\\s"])${escapeStringRegexp(str)}${options.exact ? '(?=$|[\\s"])' : ''}`, 'g')
}

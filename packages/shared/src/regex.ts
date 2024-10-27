export function escapeStringRegexp(str: string) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string')
  }
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/g, '\\$&').replaceAll('-', '\\x2d')
}

export interface MakeRegexOptions {
  /**
   * 这是为了进行精确提取用的
   * 比如同时出现了 bg-500 bg-500/50,
   * true 只会提取 bg-500
   * 而 false 会提取 2 个 bg-500
   */
  exact?: boolean
}

export function makeRegex(
  str: string,
  options: MakeRegexOptions = {
    exact: true,
  },
) {
  return new RegExp(`(?<=^|[\\s"])${escapeStringRegexp(str)}${options.exact ? '(?=$|[\\s"])' : ''}`, 'g')
}

import { splitCandidateTokensNative } from '@tailwindcss-mangle/native'

// 参考链接：https://github.com/tailwindlabs/tailwindcss/blob/master/src/lib/regex.js
// eslint-disable-next-line regexp/no-obscure-range
export const validateCandidateTokenRE = /[\w\u00A0-\uFFFF%-?]/

export function isValidCandidateToken(token = ''): token is string {
  return validateCandidateTokenRE.test(token)
}

const SPLIT_CACHE_LIMIT = 8192
const splitCache = new Map<string, string[]>()

export function splitCandidateTokens(code: string) {
  const cached = splitCache.get(code)
  if (cached) {
    return cached
  }
  const result = splitCandidateTokensNative(code)
  if (splitCache.size >= SPLIT_CACHE_LIMIT) {
    splitCache.clear()
  }
  splitCache.set(code, result)
  return result
}

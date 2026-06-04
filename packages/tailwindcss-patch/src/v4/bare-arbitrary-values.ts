export interface BareArbitraryValueOptions {
  /**
   * 允许作为无方括号任意值的单位列表。
   */
  units?: string[]
}

export interface BareArbitraryValueResolveResult {
  candidate: string
  canonicalCandidate: string
}

export interface BareArbitraryValueSourceCandidate {
  rawCandidate: string
  start: number
  end: number
}

const DEFAULT_BARE_ARBITRARY_VALUE_UNITS = [
  '%',
  'px',
  'rpx',
  'rem',
  'em',
  'vw',
  'vh',
  'vmin',
  'vmax',
  'dvw',
  'dvh',
  'svw',
  'svh',
  'lvw',
  'lvh',
  'ch',
  'ex',
  'lh',
  'rlh',
  'fr',
  'deg',
  'rad',
  'turn',
  's',
  'ms',
]

const NUMBER_RE = /^-?(?:\d+|\d*\.\d+)$/
const FUNCTION_VALUE_RE = /^[a-z_-][\w-]*\(/i
const HEX_ESCAPE_RE = /^[\da-f]$/i
const ASPECT_RATIO_RE = /^\d+\/\d+$/
const ESCAPED_WHITESPACE_RE = /\\[nrt]/g

function splitVariantPrefix(candidate: string) {
  let depth = 0
  let quote: string | undefined
  let lastSeparator = -1

  for (let index = 0; index < candidate.length; index++) {
    const character = candidate[index]
    if (character === '\\') {
      index++
      continue
    }

    if (quote) {
      if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (character === '[' || character === '(' || character === '{') {
      depth++
      continue
    }

    if (character === ']' || character === ')' || character === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth === 0 && character === ':') {
      lastSeparator = index
    }
  }

  if (lastSeparator === -1) {
    return {
      prefix: '',
      body: candidate,
    }
  }

  return {
    prefix: candidate.slice(0, lastSeparator + 1),
    body: candidate.slice(lastSeparator + 1),
  }
}

function isBalancedFunctionValue(value: string) {
  let depth = 0
  let quote: string | undefined

  for (let index = 0; index < value.length; index++) {
    const character = value[index]

    if (character === '\\') {
      index++
      continue
    }

    if (quote) {
      if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (character === '(') {
      depth++
      continue
    }

    if (character === ')') {
      depth--
      if (depth < 0) {
        return false
      }
    }
  }

  return depth === 0 && quote === undefined
}

function isEscapedAt(value: string, index: number) {
  let slashCount = 0
  for (let slashIndex = index - 1; slashIndex >= 0 && value[slashIndex] === '\\'; slashIndex--) {
    slashCount++
  }
  return slashCount % 2 === 1
}

function isBalancedBareArbitraryBody(value: string) {
  let depth = 0
  let quote: string | undefined

  for (let index = 0; index < value.length; index++) {
    const character = value[index]

    if (isEscapedAt(value, index)) {
      continue
    }

    if (quote) {
      if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (character === '(' || character === '{') {
      depth++
      continue
    }

    if (character === ')' || character === '}') {
      depth--
      if (depth < 0) {
        return false
      }
    }
  }

  return depth === 0 && quote === undefined
}

function isHexColorValue(value: string) {
  return /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6,8})$/i.test(value)
}

function isQuotedValue(value: string) {
  const quote = value[0]
  if ((quote !== '"' && quote !== '\'') || value[value.length - 1] !== quote) {
    return false
  }

  let escaped = false
  for (let index = 1; index < value.length - 1; index++) {
    const character = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === '\\') {
      escaped = true
    }
  }

  return !escaped
}

function normalizeBareArbitraryValueOptions(options: boolean | BareArbitraryValueOptions | undefined) {
  if (options === false || options === undefined || options === null) {
    return
  }

  const units = options === true ? DEFAULT_BARE_ARBITRARY_VALUE_UNITS : options.units ?? DEFAULT_BARE_ARBITRARY_VALUE_UNITS
  const normalizedUnits = [...new Set(units.filter(unit => typeof unit === 'string' && unit.length > 0))]
  if (normalizedUnits.length === 0) {
    return
  }
  return {
    units: normalizedUnits.sort((a, b) => b.length - a.length),
  }
}

export function isBareArbitraryValuesEnabled(options: boolean | BareArbitraryValueOptions | undefined) {
  return normalizeBareArbitraryValueOptions(options) !== undefined
}

function normalizeEscapedValue(value: string) {
  let result = ''
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character !== '\\') {
      result += character
      continue
    }

    const nextCharacter = value[index + 1]
    if (nextCharacter === undefined) {
      result += character
      continue
    }

    if (HEX_ESCAPE_RE.test(nextCharacter)) {
      let hex = ''
      let nextIndex = index + 1
      while (nextIndex < value.length && hex.length < 6) {
        const hexCharacter = value[nextIndex]
        if (hexCharacter === undefined || !HEX_ESCAPE_RE.test(hexCharacter)) {
          break
        }
        hex += hexCharacter
        nextIndex++
      }
      if (/[\t\n\f\r ]/.test(value[nextIndex] ?? '')) {
        nextIndex++
      }

      const decoded = String.fromCodePoint(Number.parseInt(hex, 16))
      result += decoded === '_' ? '\\_' : decoded
      index = nextIndex - 1
      continue
    }

    result += nextCharacter === '_' ? '\\_' : nextCharacter
    index++
  }
  return result
}

function resolveValueWithUnit(body: string, units: string[]) {
  const value = normalizeEscapedValue(body)
  for (const unit of units) {
    if (!value.endsWith(unit)) {
      continue
    }
    const numberPart = value.slice(0, -unit.length)
    if (NUMBER_RE.test(numberPart)) {
      return `${numberPart}${unit}`
    }
  }
}

function resolveArbitraryValue(utility: string, body: string, units: string[]) {
  const value = normalizeEscapedValue(body)
  const withUnit = resolveValueWithUnit(value, units)
  if (withUnit) {
    return withUnit
  }

  if (utility === 'aspect' && ASPECT_RATIO_RE.test(value)) {
    return value
  }

  if (isHexColorValue(value)) {
    return value
  }

  if (isQuotedValue(value)) {
    return value
  }

  if (FUNCTION_VALUE_RE.test(value) && value.endsWith(')') && isBalancedFunctionValue(value)) {
    if (utility === 'text' && /^var\(/i.test(value)) {
      return `color:${value}`
    }
    return value
  }
}

function resolveUtilityAndValue(body: string, units: string[]) {
  let depth = 0
  let quote: string | undefined

  for (let index = body.length - 1; index > 0; index--) {
    const character = body[index]

    if (isEscapedAt(body, index)) {
      continue
    }

    if (quote) {
      if (character === quote) {
        quote = undefined
      }
      continue
    }

    if (character === '"' || character === '\'') {
      quote = character
      continue
    }

    if (character === ')' || character === '}') {
      depth++
      continue
    }

    if (character === '(' || character === '{') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth > 0 || character !== '-') {
      continue
    }

    const utility = body.slice(0, index)
    const rawValue = body.slice(index + 1)
    if (!utility || !rawValue) {
      continue
    }

    const value = resolveArbitraryValue(utility, rawValue, units)
    if (value) {
      return {
        utility,
        value,
      }
    }
  }
}

export function resolveBareArbitraryValueCandidate(
  candidate: string,
  options?: boolean | BareArbitraryValueOptions,
): BareArbitraryValueResolveResult | undefined {
  const normalizedOptions = normalizeBareArbitraryValueOptions(options)
  if (!normalizedOptions || !candidate || candidate.includes('[') || candidate.includes(']')) {
    return
  }

  const { prefix, body } = splitVariantPrefix(candidate)
  const important = body.startsWith('!') ? '!' : ''
  let normalizedBody = important ? body.slice(1) : body
  const negative = normalizedBody.startsWith('-') ? '-' : ''
  if (negative) {
    normalizedBody = normalizedBody.slice(1)
  }
  if (!isBalancedBareArbitraryBody(normalizedBody)) {
    return
  }

  const resolved = resolveUtilityAndValue(normalizedBody, normalizedOptions.units)
  if (!resolved) {
    return
  }

  return {
    candidate,
    canonicalCandidate: `${prefix}${important}${negative}${resolved.utility}-[${resolved.value}]`,
  }
}

function isBareArbitrarySourceSplitter(char: string) {
  return /\s/.test(char)
}

function isQuoteBoundary(content: string, start: number, index: number) {
  const tokenPrefix = content.slice(start, index)
  return tokenPrefix.length === 0 || !tokenPrefix.endsWith('-')
}

function trimBareArbitrarySourceToken(token: string, start: number) {
  let nextToken = token
  let nextStart = start
  while (nextToken.length > 0 && /^[<{([]$/.test(nextToken[0]!)) {
    nextToken = nextToken.slice(1)
    nextStart++
  }
  while (nextToken.length > 0 && /^[>\],;]$/.test(nextToken[nextToken.length - 1]!)) {
    nextToken = nextToken.slice(0, -1)
  }
  return {
    token: nextToken,
    start: nextStart,
  }
}

function pushBareArbitrarySourceCandidate(
  result: BareArbitraryValueSourceCandidate[],
  token: string,
  start: number,
  options: boolean | BareArbitraryValueOptions | undefined,
) {
  const trimmed = trimBareArbitrarySourceToken(token, start)
  if (!trimmed.token || trimmed.token.includes('=') || trimmed.token.includes('[') || trimmed.token.includes(']')) {
    return
  }
  if (!resolveBareArbitraryValueCandidate(trimmed.token, options)) {
    return
  }
  result.push({
    rawCandidate: trimmed.token,
    start: trimmed.start,
    end: trimmed.start + trimmed.token.length,
  })
}

export function extractBareArbitraryValueSourceCandidatesWithPositions(
  content: string,
  options?: boolean | BareArbitraryValueOptions,
): BareArbitraryValueSourceCandidate[] {
  if (!isBareArbitraryValuesEnabled(options)) {
    return []
  }

  const normalized = content.includes('\\') ? content.replace(ESCAPED_WHITESPACE_RE, ' ') : content
  const result: BareArbitraryValueSourceCandidate[] = []
  let depth = 0
  let quote: string | undefined
  let start = 0

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index]
    if (char === undefined) {
      continue
    }
    if (char === '\\') {
      index++
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = undefined
      }
    }
    else if ((char === '"' || char === '\'' || char === '`') && !isQuoteBoundary(normalized, start, index)) {
      quote = char
    }
    else if (char === '(' || char === '{' || char === '[') {
      depth++
    }
    else if (char === ')' || char === '}' || char === ']') {
      depth = Math.max(0, depth - 1)
    }

    if (!isBareArbitrarySourceSplitter(char) && !((char === '"' || char === '\'' || char === '`') && depth === 0 && isQuoteBoundary(normalized, start, index))) {
      continue
    }

    pushBareArbitrarySourceCandidate(result, normalized.slice(start, index), start, options)
    start = index + 1
  }

  pushBareArbitrarySourceCandidate(result, normalized.slice(start), start, options)
  return result
}

export function extractBareArbitraryValueSourceCandidates(
  content: string,
  options?: boolean | BareArbitraryValueOptions,
) {
  return [...new Set(
    extractBareArbitraryValueSourceCandidatesWithPositions(content, options)
      .map(candidate => candidate.rawCandidate),
  )]
}

// Based on the CSS.escape algorithm, scoped to class selector escaping.
export function escapeCssClassName(value: string) {
  let result = ''
  for (let index = 0; index < value.length; index++) {
    const codeUnit = value.charCodeAt(index)
    const character = value.charAt(index)

    if (codeUnit === 0x0000) {
      result += '\uFFFD'
      continue
    }

    if (
      (codeUnit >= 0x0001 && codeUnit <= 0x001F)
      || codeUnit === 0x007F
      || (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039)
      || (index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && value.charCodeAt(0) === 0x002D)
    ) {
      result += `\\${codeUnit.toString(16)} `
      continue
    }

    if (
      codeUnit >= 0x0080
      || codeUnit === 0x002D
      || codeUnit === 0x005F
      || (codeUnit >= 0x0030 && codeUnit <= 0x0039)
      || (codeUnit >= 0x0041 && codeUnit <= 0x005A)
      || (codeUnit >= 0x0061 && codeUnit <= 0x007A)
    ) {
      result += character
      continue
    }

    result += `\\${character}`
  }
  return result
}

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
const FUNCTION_VALUE_RE = /^[a-zA-Z_-][a-zA-Z0-9_-]*\(/

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

function isHexColorValue(value: string) {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6,8})$/.test(value)
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

function resolveValueWithUnit(body: string, units: string[]) {
  for (const unit of units) {
    if (!body.endsWith(unit)) {
      continue
    }
    const numberPart = body.slice(0, -unit.length)
    if (NUMBER_RE.test(numberPart)) {
      return `${numberPart}${unit}`
    }
  }
}

function resolveArbitraryValue(body: string, units: string[]) {
  const withUnit = resolveValueWithUnit(body, units)
  if (withUnit) {
    return withUnit
  }

  if (isHexColorValue(body)) {
    return body
  }

  if (isQuotedValue(body)) {
    return body
  }

  if (FUNCTION_VALUE_RE.test(body) && body.endsWith(')') && isBalancedFunctionValue(body)) {
    return body
  }
}

function resolveUtilityAndValue(body: string, units: string[]) {
  let depth = 0
  let quote: string | undefined

  for (let index = 1; index < body.length; index++) {
    const character = body[index]

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

    if (character === '(' || character === '{') {
      depth++
      continue
    }

    if (character === ')' || character === '}') {
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

    const value = resolveArbitraryValue(rawValue, units)
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

  const resolved = resolveUtilityAndValue(normalizedBody, normalizedOptions.units)
  if (!resolved) {
    return
  }

  return {
    candidate,
    canonicalCandidate: `${prefix}${important}${negative}${resolved.utility}-[${resolved.value}]`,
  }
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

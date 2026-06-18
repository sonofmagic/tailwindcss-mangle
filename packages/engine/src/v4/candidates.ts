import type { BareArbitraryValueOptions } from './bare-arbitrary-values.ts'
import type { TailwindV4DesignSystem } from './types.ts'
import postcss from 'postcss'
import { escapeCssClassName, resolveBareArbitraryValueCandidate } from './bare-arbitrary-values.ts'

export function resolveValidTailwindV4Candidates(
  designSystem: TailwindV4DesignSystem,
  candidates: Iterable<string>,
  options?: {
    bareArbitraryValues?: boolean | BareArbitraryValueOptions
  },
): Set<string> {
  const validCandidates = new Set<string>()
  const parsedCandidates: string[] = []
  const originalCandidatesByCanonical = new Map<string, Set<string>>()

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const bareArbitrary = resolveBareArbitraryValueCandidate(candidate, options?.bareArbitraryValues)
    const candidateToCheck = bareArbitrary?.canonicalCandidate ?? candidate

    if (bareArbitrary) {
      const originalCandidates = originalCandidatesByCanonical.get(candidateToCheck) ?? new Set<string>()
      originalCandidates.add(candidate)
      originalCandidatesByCanonical.set(candidateToCheck, originalCandidates)
    }

    const alreadyParsed = parsedCandidates.includes(candidateToCheck)
    if (alreadyParsed) {
      continue
    }

    if (designSystem.parseCandidate(candidateToCheck).length > 0) {
      parsedCandidates.push(candidateToCheck)
    }
  }

  if (parsedCandidates.length === 0) {
    return validCandidates
  }

  const cssByCandidate = designSystem.candidatesToCss(parsedCandidates)
  for (let index = 0; index < parsedCandidates.length; index++) {
    const candidate = parsedCandidates[index]
    const candidateCss = cssByCandidate[index]
    if (candidate && typeof candidateCss === 'string' && candidateCss.trim().length > 0) {
      const originalCandidates = originalCandidatesByCanonical.get(candidate)
      if (originalCandidates) {
        for (const originalCandidate of originalCandidates) {
          validCandidates.add(originalCandidate)
        }
        continue
      }
      validCandidates.add(candidate)
    }
  }

  return validCandidates
}

function createSelectorAliasMap(
  candidates: Iterable<string>,
  options?: boolean | BareArbitraryValueOptions,
) {
  const aliases = new Map<string, Set<string>>()
  for (const candidate of candidates) {
    const bareArbitrary = resolveBareArbitraryValueCandidate(candidate, options)
    if (!bareArbitrary) {
      continue
    }
    const canonicalSelector = escapeCssClassName(bareArbitrary.canonicalCandidate)
    const bareSelectors = aliases.get(canonicalSelector) ?? new Set<string>()
    bareSelectors.add(escapeCssClassName(bareArbitrary.candidate))
    aliases.set(canonicalSelector, bareSelectors)
  }
  return aliases
}

export function replaceBareArbitraryValueSelectors(
  css: string,
  candidates: Iterable<string>,
  options?: boolean | BareArbitraryValueOptions,
) {
  const aliases = createSelectorAliasMap(candidates, options)
  if (aliases.size === 0) {
    return css
  }

  if (Array.from(aliases.values()).every(bareSelectors => bareSelectors.size === 1)) {
    let result = css
    for (const [canonicalSelector, bareSelectors] of aliases) {
      const bareSelector = Array.from(bareSelectors)[0]
      if (bareSelector !== undefined) {
        result = result.replaceAll(canonicalSelector, bareSelector)
      }
    }
    return result
  }

  const root = postcss.parse(css)
  root.walkRules((rule) => {
    let selectors = rule.selectors
    for (const [canonicalSelector, bareSelectors] of aliases) {
      selectors = selectors.flatMap((selector) => {
        if (!selector.includes(canonicalSelector)) {
          return selector
        }
        return Array.from(bareSelectors, bareSelector => selector.replaceAll(canonicalSelector, bareSelector))
      })
    }
    rule.selectors = selectors
  })
  return root.toString()
}

export function canonicalizeBareArbitraryValueCandidates(
  candidates: Iterable<string>,
  options?: boolean | BareArbitraryValueOptions,
) {
  return Array.from(candidates, (candidate) => {
    const bareArbitrary = resolveBareArbitraryValueCandidate(candidate, options)
    return bareArbitrary?.canonicalCandidate ?? candidate
  })
}

function splitTopLevel(value: string, separator: string, options?: { keepEmpty?: boolean }) {
  const result: string[] = []
  let start = 0
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

    if (character === '(' || character === '[' || character === '{') {
      depth++
      continue
    }

    if (character === ')' || character === ']' || character === '}') {
      depth = Math.max(0, depth - 1)
      continue
    }

    if (depth === 0 && character === separator) {
      const item = value.slice(start, index).trim()
      if (item || options?.keepEmpty) {
        result.push(item)
      }
      start = index + 1
    }
  }

  const item = value.slice(start).trim()
  if (item || options?.keepEmpty) {
    result.push(item)
  }
  return result
}

const sequencePattern = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/

function expandSequence(value: string) {
  const match = value.match(sequencePattern)
  if (!match) {
    return [value]
  }

  const [, startValue, endValue, stepValue] = match
  if (startValue === undefined || endValue === undefined) {
    return [value]
  }

  const start = Number.parseInt(startValue, 10)
  const end = Number.parseInt(endValue, 10)
  let step = stepValue === undefined ? (start <= end ? 1 : -1) : Number.parseInt(stepValue, 10)
  if (step === 0) {
    throw new Error('Step cannot be zero in Tailwind CSS v4 inline source sequence.')
  }

  const ascending = start < end
  if (ascending && step < 0) {
    step = -step
  }
  if (!ascending && step > 0) {
    step = -step
  }

  const result: string[] = []
  for (let current = start; ascending ? current <= end : current >= end; current += step) {
    result.push(current.toString())
  }
  return result
}

function expandInlinePattern(pattern: string): string[] {
  const openIndex = pattern.indexOf('{')
  if (openIndex === -1) {
    return [pattern]
  }

  const prefix = pattern.slice(0, openIndex)
  const rest = pattern.slice(openIndex)
  let depth = 0
  let closeIndex = -1
  for (let index = 0; index < rest.length; index++) {
    const character = rest[index]
    if (character === '{') {
      depth++
    }
    else if (character === '}') {
      depth--
      if (depth === 0) {
        closeIndex = index
        break
      }
    }
  }

  if (closeIndex === -1) {
    throw new Error(`The Tailwind CSS v4 inline source pattern "${pattern}" is not balanced.`)
  }

  const body = rest.slice(1, closeIndex)
  const suffix = rest.slice(closeIndex + 1)
  const parts = sequencePattern.test(body)
    ? expandSequence(body)
    : splitTopLevel(body, ',', { keepEmpty: true }).flatMap(part => expandInlinePattern(part))
  const suffixes = expandInlinePattern(suffix)

  const result: string[] = []
  for (const part of parts) {
    for (const expandedSuffix of suffixes) {
      result.push(`${prefix}${part}${expandedSuffix}`)
    }
  }
  return result
}

function unquoteCssString(value: string) {
  const quote = value[0]
  if ((quote !== '"' && quote !== '\'') || value[value.length - 1] !== quote) {
    return undefined
  }

  let result = ''
  for (let index = 1; index < value.length - 1; index++) {
    const character = value[index]
    if (character === '\\') {
      index++
      result += value[index] ?? ''
      continue
    }
    result += character
  }
  return result
}

export function extractTailwindV4InlineSourceCandidates(css: string) {
  const included = new Set<string>()
  const excluded = new Set<string>()

  const root = postcss.parse(css)
  root.walkAtRules('source', (rule) => {
    let params = rule.params.trim()
    if (!params) {
      return
    }

    let negated = false
    if (params.startsWith('not ')) {
      negated = true
      params = params.slice(4).trim()
    }

    if (!params.startsWith('inline(') || !params.endsWith(')')) {
      return
    }

    const inlineValue = unquoteCssString(params.slice(7, -1).trim())
    if (inlineValue === undefined) {
      return
    }

    const target = negated ? excluded : included
    for (const part of splitTopLevel(inlineValue, ' ')) {
      for (const candidate of expandInlinePattern(part)) {
        target.add(candidate)
      }
    }
  })

  return {
    included,
    excluded,
  }
}

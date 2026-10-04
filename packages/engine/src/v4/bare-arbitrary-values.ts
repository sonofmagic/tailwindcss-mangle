import { escapeCssClassNameNative, extractBareArbitraryCandidatesNative, resolveBareArbitraryCandidatesNative } from '@tailwindcss-mangle/native'

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

export function resolveBareArbitraryValueCandidates(
  candidates: string[],
  options?: boolean | BareArbitraryValueOptions,
): Array<BareArbitraryValueResolveResult | undefined> {
  const normalized = normalizeBareArbitraryValueOptions(options)
  if (!normalized) {
    return candidates.map(() => undefined)
  }
  return resolveBareArbitraryCandidatesNative(candidates, normalized.units)
    .map((canonicalCandidate, index) => canonicalCandidate == null
      ? undefined
      : { candidate: candidates[index]!, canonicalCandidate })
}

export function resolveBareArbitraryValueCandidate(
  candidate: string,
  options?: boolean | BareArbitraryValueOptions,
): BareArbitraryValueResolveResult | undefined {
  return resolveBareArbitraryValueCandidates([candidate], options)[0]
}

export function extractBareArbitraryValueSourceCandidatesWithPositions(
  content: string,
  options?: boolean | BareArbitraryValueOptions,
): BareArbitraryValueSourceCandidate[] {
  const normalized = normalizeBareArbitraryValueOptions(options)
  return normalized ? extractBareArbitraryCandidatesNative(content, normalized.units) : []
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

export const escapeCssClassName = escapeCssClassNameNative

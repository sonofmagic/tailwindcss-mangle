import type { BareArbitraryValueOptions } from './bare-arbitrary-values.ts'
import type { TailwindV4DesignSystem } from './types.ts'
import { extractInlineSourceCandidatesNative, replaceBareArbitrarySelectorsNative } from '@tailwindcss-mangle/native'
import { resolveBareArbitraryValueCandidates } from './bare-arbitrary-values.ts'

export function resolveValidTailwindV4Candidates(
  designSystem: TailwindV4DesignSystem,
  candidates: Iterable<string>,
  options?: {
    bareArbitraryValues?: boolean | BareArbitraryValueOptions
  },
): Set<string> {
  const validCandidates = new Set<string>()
  const parsedCandidates: string[] = []
  const parsed = new Set<string>()
  const originalCandidatesByCanonical = new Map<string, Set<string>>()

  const candidateList = [...candidates]
  const resolvedCandidates = resolveBareArbitraryValueCandidates(candidateList, options?.bareArbitraryValues)
  for (const [index, candidate] of candidateList.entries()) {
    if (!candidate) {
      continue
    }

    const bareArbitrary = resolvedCandidates[index]
    const candidateToCheck = bareArbitrary?.canonicalCandidate ?? candidate

    if (bareArbitrary) {
      const originalCandidates = originalCandidatesByCanonical.get(candidateToCheck) ?? new Set<string>()
      originalCandidates.add(candidate)
      originalCandidatesByCanonical.set(candidateToCheck, originalCandidates)
    }

    const alreadyParsed = parsed.has(candidateToCheck)
    if (alreadyParsed) {
      continue
    }

    if (designSystem.parseCandidate(candidateToCheck).length > 0) {
      parsedCandidates.push(candidateToCheck)
      parsed.add(candidateToCheck)
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

export function replaceBareArbitraryValueSelectors(
  css: string,
  candidates: Iterable<string>,
  options?: boolean | BareArbitraryValueOptions,
) {
  const aliases = resolveBareArbitraryValueCandidates([...candidates], options)
    .flatMap(resolved => resolved ? [{ canonical: resolved.canonicalCandidate, candidate: resolved.candidate }] : [])
  return aliases.length === 0 ? css : replaceBareArbitrarySelectorsNative(css, aliases)
}

export function canonicalizeBareArbitraryValueCandidates(
  candidates: Iterable<string>,
  options?: boolean | BareArbitraryValueOptions,
) {
  const candidateList = [...candidates]
  return resolveBareArbitraryValueCandidates(candidateList, options)
    .map((resolved, index) => resolved?.canonicalCandidate ?? candidateList[index]!)
}

export function extractTailwindV4InlineSourceCandidates(css: string) {
  const result = extractInlineSourceCandidatesNative(css)
  return { included: new Set(result.included), excluded: new Set(result.excluded) }
}

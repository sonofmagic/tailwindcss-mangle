import type { ExtractCandidateOptions, ExtractSourceCandidateWithContext } from './types.ts'
import { extractCssApplySegmentsNative } from '@tailwindcss-mangle/native'
import { createBareArbitraryValueCandidateContexts } from './segments.ts'

export async function extractCssApplyCandidates(
  content: string,
  extension: string,
  extractRawCandidatesWithPositions: (
    content: string,
    extension: string,
    options?: ExtractCandidateOptions,
  ) => Promise<Array<{ rawCandidate: string, start: number, end: number }>>,
  options?: ExtractCandidateOptions,
) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  for (const segment of extractCssApplySegmentsNative(content)) {
    const applyParams = segment.content
    const applyParamsStart = segment.start
    const applyCandidates = await extractRawCandidatesWithPositions(applyParams, extension)
    candidates.push(...applyCandidates.map(candidate => ({
      content: applyParams,
      extension: 'html',
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      skipHtmlContextChecks: true,
      start: candidate.start + applyParamsStart,
      end: candidate.end + applyParamsStart,
    })))
    candidates.push(...createBareArbitraryValueCandidateContexts(applyParams, 'html', applyParamsStart, options))
  }
  return candidates
}

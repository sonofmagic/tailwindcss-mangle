import type { EngineSourceSegment, SfcSourceSegments } from '@tailwindcss-mangle/native'
import type { ExtractCandidateOptions, ExtractSourceCandidateWithContext } from './types.ts'
import { extractSfcSourceSegmentsNative, findAttributeValueStartNative } from '@tailwindcss-mangle/native'
import { extractCssApplyCandidates } from './css.ts'
import { createJsStringSourceSegments } from './js-string-ranges.ts'
import { extractBatchedSourceSegmentCandidates } from './segments.ts'
import { isClassLikeCandidate } from './source-filters.ts'

type RawCandidateExtractor = (
  content: string,
  extension: string,
  options?: ExtractCandidateOptions,
) => Promise<Array<{ rawCandidate: string, start: number, end: number }>>

export const findAttributeValueStart = findAttributeValueStartNative

export async function extractJsStringSourceCandidates(
  content: string,
  offset: number,
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const segments = createJsStringSourceSegments(content, offset)
  return extractBatchedSourceSegmentCandidates(segments, 'html', extractRawCandidatesWithPositions, options)
}

async function extractScriptSegments(
  segments: EngineSourceSegment[],
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  for (const segment of segments) {
    candidates.push(...await extractJsStringSourceCandidates(segment.content, segment.start, extractRawCandidatesWithPositions, options))
  }
  return candidates
}

export async function extractMixedSourceScriptCandidates(
  content: string,
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  return extractScriptSegments(extractSfcSourceSegmentsNative(content).scripts, extractRawCandidatesWithPositions, options)
}

async function extractStyleSegments(
  segments: EngineSourceSegment[],
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  for (const segment of segments) {
    const styleCandidates = await extractCssApplyCandidates(segment.content, 'css', extractRawCandidatesWithPositions, options)
    candidates.push(...styleCandidates.map(candidate => ({
      ...candidate,
      start: candidate.start + segment.start,
      end: candidate.end + segment.start,
    })))
  }
  return candidates
}

async function extractTemplateAttributes(
  segments: SfcSourceSegments,
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const jsStringSegments = segments.bound.flatMap(segment => createJsStringSourceSegments(segment.content, segment.start))
  const [htmlCandidates, jsCandidates] = await Promise.all([
    extractBatchedSourceSegmentCandidates(segments.html, 'html', extractRawCandidatesWithPositions, options),
    extractBatchedSourceSegmentCandidates(jsStringSegments, 'html', extractRawCandidatesWithPositions, options),
  ])
  return [...htmlCandidates, ...jsCandidates]
}

async function extractPreprocessedTemplates(
  segments: EngineSourceSegment[],
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  for (const segment of segments) {
    const templateCandidates = await extractRawCandidatesWithPositions(segment.content, segment.extension, options)
    candidates.push(...templateCandidates.map(candidate => ({
      content: segment.content,
      extension: segment.extension,
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      skipHtmlContextChecks: true,
      start: candidate.start + segment.start,
      end: candidate.end + segment.start,
    })).filter(candidate => isClassLikeCandidate(candidate.rawCandidate)))
  }
  return candidates
}

export async function extractVueLikeSourceCandidates(
  content: string,
  extractRawCandidatesWithPositions: RawCandidateExtractor,
  options?: ExtractCandidateOptions,
) {
  const segments = extractSfcSourceSegmentsNative(content)
  const [templateCandidates, preprocessedTemplateCandidates, scriptCandidates, styleCandidates] = await Promise.all([
    extractTemplateAttributes(segments, extractRawCandidatesWithPositions, options),
    extractPreprocessedTemplates(segments.templates, extractRawCandidatesWithPositions, options),
    extractScriptSegments(segments.scripts, extractRawCandidatesWithPositions, options),
    extractStyleSegments(segments.styles, extractRawCandidatesWithPositions, options),
  ])
  return [...templateCandidates, ...preprocessedTemplateCandidates, ...scriptCandidates, ...styleCandidates]
}

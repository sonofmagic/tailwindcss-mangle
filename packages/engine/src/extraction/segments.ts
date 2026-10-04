import type { ExtractCandidateOptions, ExtractSourceCandidateWithContext, JoinedSourceSegment, SourceSegment } from './types.ts'
import { joinSourceSegmentsNative, remapSourceCandidatesNative } from '@tailwindcss-mangle/native'
import { extractBareArbitraryValueSourceCandidatesWithPositions } from '../v4/bare-arbitrary-values.ts'

export function createBareArbitraryValueCandidateContexts(
  content: string,
  extension: string,
  offset: number,
  options?: ExtractCandidateOptions,
): ExtractSourceCandidateWithContext[] {
  return extractBareArbitraryValueSourceCandidatesWithPositions(content, options?.bareArbitraryValues)
    .map(candidate => ({
      content,
      extension,
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      start: candidate.start + offset,
      end: candidate.end + offset,
    }))
}

export function joinSourceSegments(segments: SourceSegment[]) {
  const joined = joinSourceSegmentsNative(segments)
  return { content: joined.content, segments: joined.segments as JoinedSourceSegment[] }
}

export function findJoinedSourceSegment(segments: JoinedSourceSegment[], start: number) {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const segment = segments[mid]
    if (segment === undefined) {
      break
    }
    if (start < segment.joinedStart) {
      high = mid - 1
      continue
    }
    if (start >= segment.joinedStart + segment.content.length) {
      low = mid + 1
      continue
    }
    return segment
  }
  return undefined
}

export async function extractBatchedSourceSegmentCandidates(
  segments: SourceSegment[],
  extension: string,
  extractRawCandidatesWithPositions: (
    content: string,
    extension: string,
    options?: ExtractCandidateOptions,
  ) => Promise<Array<{ rawCandidate: string, start: number, end: number }>>,
  options?: ExtractCandidateOptions,
) {
  if (segments.length === 0) {
    return []
  }

  const joined = joinSourceSegments(segments)
  const rawCandidates = await extractRawCandidatesWithPositions(joined.content, extension, options)
  return remapSourceCandidatesNative(joined.segments, rawCandidates).map(candidate => ({
    ...candidate,
    content: joined.content,
    extension,
    skipHtmlContextChecks: true,
  }))
}

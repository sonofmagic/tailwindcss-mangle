import type { JsStringStaticRange, SourceSegment } from './types.ts'
import { createJsStringStaticRangesNative } from '@tailwindcss-mangle/native'

export const createJsStringStaticRanges = createJsStringStaticRangesNative

export function isCandidateInsideJsStringStaticRanges(ranges: JsStringStaticRange[], start: number) {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const range = ranges[mid]
    if (range === undefined) {
      break
    }
    if (start < range.start) {
      high = mid - 1
      continue
    }
    if (start >= range.end) {
      low = mid + 1
      continue
    }
    return true
  }
  return false
}

export function createJsStringSourceSegments(
  content: string,
  offset: number,
): SourceSegment[] {
  return createJsStringStaticRanges(content)
    .filter(range => range.end > range.start)
    .map(range => ({
      content: content.slice(range.start, range.end),
      start: offset + range.start,
    }))
}

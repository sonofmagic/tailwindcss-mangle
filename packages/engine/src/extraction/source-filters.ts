import type { ExtractSourceCandidate, ExtractSourceCandidateWithContext, JsStringStaticRange } from './types.ts'
import { dedupeCandidatesNative, filterSourceCandidateIndexesNative } from '@tailwindcss-mangle/native'

export const JS_LIKE_SOURCE_EXTENSION_RE = /^[cm]?[jt]sx?$/
export const MIXED_TEMPLATE_SOURCE_EXTENSION_RE = /^(?:vue|uvue|nvue|svelte|mpx)$/
export const VUE_LIKE_SOURCE_EXTENSION_RE = /^(?:vue|uvue|nvue)$/
export const CSS_LIKE_SOURCE_EXTENSION_RE = /^(?:css|wxss|acss|jxss|ttss|qss|tyss|scss|sass|less|styl|stylus)$/

export function isWhitespace(value: string | undefined) {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t' || value === '\f'
}

export function isClassLikeCandidate(candidate: string) {
  return /[:![\]#/%._\-\d]/.test(candidate)
}

export function filterSourceCandidates(
  content: string,
  extension: string,
  candidates: ExtractSourceCandidate[],
  skipHtmlContextChecks = false,
  jsStringStaticRanges?: JsStringStaticRange[],
) {
  return filterSourceCandidateIndexesNative(content, extension, candidates, skipHtmlContextChecks, jsStringStaticRanges)
}

export function shouldKeepSourceCandidate(
  content: string,
  extension: string,
  candidate: ExtractSourceCandidate,
  jsStringStaticRanges?: JsStringStaticRange[],
  skipHtmlContextChecks = false,
) {
  return filterSourceCandidates(content, extension, [candidate], skipHtmlContextChecks, jsStringStaticRanges).length > 0
}

export function createLocalCandidate(candidate: ExtractSourceCandidateWithContext): ExtractSourceCandidate {
  return {
    rawCandidate: candidate.rawCandidate,
    start: candidate.localStart,
    end: candidate.localStart + candidate.rawCandidate.length,
  }
}

export const dedupeCandidatesWithPositions = dedupeCandidatesNative

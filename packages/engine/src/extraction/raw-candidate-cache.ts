import type { SourceEntry } from '@tailwindcss/oxide'
import type { ExtractCandidateOptions } from './types.ts'
import process from 'node:process'
import { createRawCandidateFileFingerprintNative, NativeRawCandidateCache } from '@tailwindcss-mangle/native'

const DEFAULT_RAW_CANDIDATE_CACHE_LIMIT = 64
export function resolveRawCandidateCacheLimit(rawLimit: string | undefined) {
  if (rawLimit === undefined) {
    return DEFAULT_RAW_CANDIDATE_CACHE_LIMIT
  }
  const limit = Number.parseInt(rawLimit, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_RAW_CANDIDATE_CACHE_LIMIT
}

const RAW_CANDIDATE_CACHE_LIMIT = resolveRawCandidateCacheLimit(process.env['TWM_ENGINE_RAW_CANDIDATE_CACHE_LIMIT'])

const rawCandidateCache = new NativeRawCandidateCache(RAW_CANDIDATE_CACHE_LIMIT)

export function createRawCandidateCacheKey(sources: SourceEntry[] | undefined, options?: ExtractCandidateOptions) {
  return JSON.stringify({
    sources: sources ?? null,
    bareArbitraryValues: options?.bareArbitraryValues ?? null,
  })
}

export async function createRawCandidateFileFingerprint(files: string[] | undefined) {
  return files?.length ? createRawCandidateFileFingerprintNative(files) : ''
}

export function getRawCandidateCacheEntry(cacheKey: string, fingerprint: string) {
  return rawCandidateCache.get(cacheKey, fingerprint) ?? undefined
}

export function setRawCandidateCacheEntry(cacheKey: string, fingerprint: string, candidates: string[]) {
  rawCandidateCache.set(cacheKey, fingerprint, candidates)
}

export const CACHE_SCHEMA_VERSION = 2
export const CACHE_FINGERPRINT_VERSION = 1

export type CacheSchemaVersion = typeof CACHE_SCHEMA_VERSION
export type CacheFingerprintVersion = typeof CACHE_FINGERPRINT_VERSION
export type CacheClearScope = 'current' | 'all'

export interface CacheContextMetadata {
  fingerprintVersion: CacheFingerprintVersion
  projectRootRealpath: string
  processCwdRealpath: string
  cacheCwdRealpath: string
  tailwindConfigPath?: string
  tailwindConfigMtimeMs?: number
  tailwindPackageRootRealpath: string
  tailwindPackageVersion: string
  patcherVersion: string
  majorVersion: 2 | 3 | 4
  optionsHash: string
}

export interface CacheContextDescriptor {
  fingerprint: string
  metadata: CacheContextMetadata
}

export interface CacheIndexEntry {
  context: CacheContextMetadata
  values: string[]
  updatedAt: string
}

export interface CacheIndexFileV2 {
  schemaVersion: CacheSchemaVersion
  updatedAt: string
  contexts: Record<string, CacheIndexEntry>
}

export type CacheReadReason
  = 'hit'
    | 'cache-disabled'
    | 'noop-driver'
    | 'file-missing'
    | 'context-not-found'
    | 'context-mismatch'
    | 'legacy-schema'
    | 'invalid-schema'

export interface CacheReadMeta {
  hit: boolean
  reason: CacheReadReason
  fingerprint?: string
  schemaVersion?: number
  details: string[]
}

export interface CacheReadResult {
  data: Set<string>
  meta: CacheReadMeta
}

export interface CacheClearOptions {
  scope?: CacheClearScope
}

export interface CacheClearResult {
  scope: CacheClearScope
  filesRemoved: number
  entriesRemoved: number
  contextsRemoved: number
}

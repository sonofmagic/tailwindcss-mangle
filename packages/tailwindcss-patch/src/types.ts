import type {
  ApplyOptions,
  CacheOptions,
  CacheStrategy,
  ExposeContextOptions,
  ExtendLengthUnitsOptions,
  ExtractOptions,
  NormalizedTailwindCssPatchOptions,
  TailwindCssOptions,
  TailwindCssPatchOptions,
  TailwindV2Options,
  TailwindV3Options,
  TailwindV4Options,
} from './options/types'

export interface TailwindPatchRuntime {
  options: NormalizedTailwindCssPatchOptions
  majorVersion: 2 | 3 | 4
}

export type {
  CacheClearOptions,
  CacheClearResult,
  CacheClearScope,
  CacheContextMetadata,
  CacheReadMeta,
} from './cache/types'

export type {
  ApplyOptions,
  CacheOptions,
  CacheStrategy,
  ExposeContextOptions,
  ExtendLengthUnitsOptions,
  ExtractOptions,
  NormalizedTailwindCssPatchOptions,
  TailwindCssOptions,
  TailwindCssPatchOptions,
  TailwindV2Options,
  TailwindV3Options,
  TailwindV4Options,
}

export interface ILengthUnitsPatchOptions {
  units: string[]
  lengthUnitsFilePath?: string
  variableName?: string
  overwrite?: boolean
  destPath?: string
}

export type PatchCheckStatus
  = | 'applied'
    | 'not-applied'
    | 'skipped'
    | 'unsupported'

export type PatchName = 'exposeContext' | 'extendLengthUnits'

export interface PatchStatusEntry {
  name: PatchName
  status: PatchCheckStatus
  reason?: string
  files: string[]
}

export interface PatchStatusReport {
  package: {
    name?: string
    version?: string
    root: string
  }
  majorVersion: 2 | 3 | 4
  entries: PatchStatusEntry[]
}

export type {
  ExtractResult,
  TailwindcssClassCache,
  TailwindcssRuntimeContext,
  TailwindTokenByFileMap,
  TailwindTokenFileKey,
  TailwindTokenLocation,
  TailwindTokenReport,
} from '@tailwindcss-mangle/engine'

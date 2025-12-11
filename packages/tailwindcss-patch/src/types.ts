import type { SourceEntry } from '@tailwindcss/oxide'
import type { Node, Rule } from 'postcss'
import type { Config } from 'tailwindcss'
import type { CacheStrategy, NormalizedTailwindcssPatchOptions, TailwindcssPatchOptions } from './options/types'

type TailwindcssClassCacheEntry = Rule | {
  layer: string
  options: Record<string, any>
  sort: Record<string, any>
}

export type TailwindcssClassCache = Map<string, TailwindcssClassCacheEntry[]>

export interface TailwindcssRuntimeContext {
  applyClassCache: Map<any, any>
  candidateRuleCache: Map<
    string,
    Set<
      [
        {
          arbitrary: any
          index: any
          layer: string
          options: any[]
          parallelIndex: any
          parentLayer: string
          variants: any
        },
        Node,
      ]
    >
  >
  candidateRuleMap: Map<string | string, [object, Node][]>
  changedContent: any[]
  classCache: TailwindcssClassCache
  disposables: any[]
  getClassList: (...args: any[]) => any
  getClassOrder: (...args: any[]) => any
  getVariants: (...args: any[]) => any
  markInvalidUtilityCandidate: (...args: any[]) => any
  markInvalidUtilityNode: (...args: any[]) => any
  notClassCache: Set<string>
  offsets: {
    layerPositions: object
    offsets: object
    reservedVariantBits: any
    variantOffsets: Map<string, any>
  }
  postCssNodeCache: Map<object, [Node]>
  ruleCache: Set<[object, Node]>
  stylesheetCache: Record<string, Set<any>>
  tailwindConfig: Config
  userConfigPath: string | null
  variantMap: Map<string, [[object, (...args: any[]) => unknown]]>
  variantOptions: Map<string, object>
}

export interface ExtractResult {
  classList: string[]
  classSet: Set<string>
  filename?: string
}

export interface TailwindTokenLocation {
  rawCandidate: string
  file: string
  relativeFile: string
  extension: string
  start: number
  end: number
  length: number
  line: number
  column: number
  lineText: string
}

export type TailwindTokenFileKey = 'relative' | 'absolute'

export interface TailwindTokenReport {
  entries: TailwindTokenLocation[]
  filesScanned: number
  sources: SourceEntry[]
  skippedFiles: {
    file: string
    reason: string
  }[]
}

export type TailwindTokenByFileMap = Record<string, TailwindTokenLocation[]>

export interface TailwindPatchRuntime {
  options: NormalizedTailwindcssPatchOptions
  majorVersion: 2 | 3 | 4
}

export type { CacheStrategy, NormalizedTailwindcssPatchOptions, TailwindcssPatchOptions }

export interface ILengthUnitsPatchOptions {
  units: string[]
  lengthUnitsFilePath?: string
  variableName?: string
  overwrite?: boolean
  destPath?: string
}

export type PatchCheckStatus = 'applied' | 'not-applied' | 'skipped' | 'unsupported'

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

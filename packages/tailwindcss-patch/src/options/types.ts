import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'
import type { ILengthUnitsPatchOptions } from '../types'

export type CacheStrategy = 'merge' | 'overwrite'

export interface CacheUserOptions {
  enabled?: boolean
  cwd?: string
  dir?: string
  file?: string
  strategy?: CacheStrategy
}

export interface OutputUserOptions {
  enabled?: boolean
  file?: string
  format?: 'json' | 'lines'
  pretty?: number | boolean
  removeUniversalSelector?: boolean
}

export interface ExposeContextUserOptions {
  refProperty?: string
}

export interface ExtendLengthUnitsUserOptions extends Partial<ILengthUnitsPatchOptions> {
  enabled?: boolean
}

export interface FeatureUserOptions {
  exposeContext?: boolean | ExposeContextUserOptions
  extendLengthUnits?: false | ExtendLengthUnitsUserOptions
}

export interface TailwindConfigUserOptions {
  config?: string
  cwd?: string
  postcssPlugin?: string
}

export interface TailwindV4UserOptions {
  base?: string
  css?: string
  cssEntries?: string[]
  sources?: SourceEntry[]
}

export interface TailwindUserOptions extends TailwindConfigUserOptions {
  /**
   * Optional hint for picking the patch strategy.
   * When omitted we infer from the installed Tailwind CSS package version.
   */
  version?: 2 | 3 | 4
  packageName?: string
  resolve?: PackageResolvingOptions
  v2?: TailwindConfigUserOptions
  v3?: TailwindConfigUserOptions
  v4?: TailwindV4UserOptions
}

export interface TailwindcssPatchOptions {
  /**
   * Base directory used when resolving Tailwind resources.
   * Defaults to `process.cwd()`.
   */
  cwd?: string
  overwrite?: boolean
  tailwind?: TailwindUserOptions
  features?: FeatureUserOptions
  filter?: (className: string) => boolean
  cache?: boolean | CacheUserOptions
  output?: OutputUserOptions
}

export interface NormalizedOutputOptions {
  enabled: boolean
  file?: string
  format: 'json' | 'lines'
  pretty: number | false
  removeUniversalSelector: boolean
}

export interface NormalizedCacheOptions {
  enabled: boolean
  cwd: string
  dir: string
  file: string
  path: string
  strategy: CacheStrategy
}

export interface NormalizedExposeContextOptions {
  enabled: boolean
  refProperty: string
}

export interface NormalizedExtendLengthUnitsOptions extends ILengthUnitsPatchOptions {
  enabled: boolean
}

export interface NormalizedTailwindV4Options {
  base: string
  css?: string
  cssEntries: string[]
  sources: SourceEntry[]
}

export interface NormalizedTailwindConfigOptions extends TailwindConfigUserOptions {
  packageName: string
  versionHint?: 2 | 3 | 4
  resolve?: PackageResolvingOptions
  v2?: TailwindConfigUserOptions
  v3?: TailwindConfigUserOptions
  v4?: NormalizedTailwindV4Options
}

export interface NormalizedFeatureOptions {
  exposeContext: NormalizedExposeContextOptions
  extendLengthUnits: NormalizedExtendLengthUnitsOptions | null
}

export interface NormalizedTailwindcssPatchOptions {
  projectRoot: string
  overwrite: boolean
  tailwind: NormalizedTailwindConfigOptions
  features: NormalizedFeatureOptions
  output: NormalizedOutputOptions
  cache: NormalizedCacheOptions
  filter: (className: string) => boolean
}

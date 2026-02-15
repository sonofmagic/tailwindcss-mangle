/* c8 ignore start */

import type { FilterPattern } from '@rollup/pluginutils'
import type { IClassGeneratorOptions } from '@tailwindcss-mangle/shared'
import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'

export interface TransformerMappingConfig {
  enabled?: boolean
  file?: string
  loose?: boolean
}

export interface TransformerMappingEntry {
  original: string
  mangled: string
  usedBy: string[]
}

export type TransformerMappingOption =
  | boolean
  | TransformerMappingConfig
  | ((entries: TransformerMappingEntry[]) => void)

export interface TransformerRegistryOptions {
  file?: string
  mapping?: TransformerMappingOption
}

export interface TransformerSourceOptions {
  include?: FilterPattern
  exclude?: FilterPattern
}

export interface TransformerPreserveOptions {
  functions?: string[]
  classes?: string[]
}

export interface TransformerOptions {
  disabled?: boolean
  filter?: (className: string) => boolean
  generator?: IClassGeneratorOptions
  sources?: TransformerSourceOptions
  registry?: TransformerRegistryOptions
  preserve?: TransformerPreserveOptions
}

export interface TailwindLocatorOptions {
  cwd?: string
  config?: string
}

export interface TailwindNextOptions {
  sources?: SourceEntry[]
  base?: string
  css?: string
  cssEntries?: string[]
}

export interface RegistryExposeContextOptions {
  refProperty?: string
}

export interface RegistryExtendLengthUnitsOptions {
  enabled?: boolean
  units?: string[]
  lengthUnitsFilePath?: string
  variableName?: string
  overwrite?: boolean
  destPath?: string
}

export interface RegistryApplyOptions {
  overwrite?: boolean
  exposeContext?: boolean | RegistryExposeContextOptions
  extendLengthUnits?: false | RegistryExtendLengthUnitsOptions
}

export interface RegistryExtractOptions {
  write?: boolean
  file?: string
  format?: 'json' | 'lines'
  pretty?: boolean | number
  removeUniversalSelector?: boolean
}

export interface RegistryCacheOptions {
  enabled?: boolean
  cwd?: string
  dir?: string
  file?: string
  strategy?: 'merge' | 'overwrite'
  driver?: 'file' | 'memory' | 'noop'
}

export interface TailwindTargetOptions {
  version?: 2 | 3 | 4
  packageName?: string
  /** @deprecated Use `packageName` instead. */
  package?: string
  resolve?: PackageResolvingOptions
  v2?: TailwindLocatorOptions
  v3?: TailwindLocatorOptions
  v4?: TailwindNextOptions
  /** @deprecated Use `v2` instead. */
  legacy?: TailwindLocatorOptions
  /** @deprecated Use `v3` instead. */
  classic?: TailwindLocatorOptions
  /** @deprecated Use `v4` instead. */
  next?: TailwindNextOptions
  cwd?: string
  config?: string
}

export interface RegistryOutputOptions {
  file?: string
  pretty?: boolean | number
  stripUniversalSelector?: boolean
}

export interface RegistryOptions {
  projectRoot?: string
  tailwindcss?: TailwindTargetOptions
  apply?: RegistryApplyOptions
  extract?: RegistryExtractOptions
  cache?: RegistryCacheOptions
  filter?: (className: string) => boolean
  /** @deprecated Use `extract` instead. */
  output?: RegistryOutputOptions
  /** @deprecated Use `tailwindcss` instead. */
  tailwind?: TailwindTargetOptions
}

export interface TailwindcssMangleConfig {
  registry?: RegistryOptions
  transformer?: TransformerOptions
}

export type UserConfig = TailwindcssMangleConfig

/* c8 ignore end */

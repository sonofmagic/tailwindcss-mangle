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

export type TransformerMappingOption
  = | boolean
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

interface TailwindRuntimeOptionsBase {
  cwd?: string
  config?: string
}

export interface TailwindV2Options extends TailwindRuntimeOptionsBase {}

export interface TailwindV3Options extends TailwindRuntimeOptionsBase {}

export interface TailwindV4Options {
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

export interface TailwindCssOptions {
  version?: 2 | 3 | 4
  packageName?: string
  resolve?: PackageResolvingOptions
  v2?: TailwindV2Options
  v3?: TailwindV3Options
  v4?: TailwindV4Options
  cwd?: string
  config?: string
}

export interface RegistryOptions {
  projectRoot?: string
  tailwindcss?: TailwindCssOptions
  apply?: RegistryApplyOptions
  extract?: RegistryExtractOptions
  cache?: RegistryCacheOptions
  filter?: (className: string) => boolean
}

export interface TailwindcssMangleConfig {
  registry?: RegistryOptions
  transformer?: TransformerOptions
}

export type UserConfig = TailwindcssMangleConfig

/* c8 ignore end */

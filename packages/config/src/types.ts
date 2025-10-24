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

export interface TailwindTargetOptions {
  version?: 2 | 3 | 4
  package?: string
  resolve?: PackageResolvingOptions
  legacy?: TailwindLocatorOptions
  classic?: TailwindLocatorOptions
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
  output?: RegistryOutputOptions
  tailwind?: TailwindTargetOptions
}

export interface TailwindcssMangleConfig {
  registry?: RegistryOptions
  transformer?: TransformerOptions
}

export type UserConfig = TailwindcssMangleConfig

/* c8 ignore end */

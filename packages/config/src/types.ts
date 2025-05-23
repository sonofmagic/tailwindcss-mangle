import type { FilterPattern } from '@rollup/pluginutils'
import type { IClassGeneratorOptions } from '@tailwindcss-mangle/shared'
import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'

export interface ClassMapOutputOptions {
  enable?: boolean
  filename?: string
  loose?: boolean
}

export interface ClassMapOutputItem {
  before: string
  after: string
  usedBy: string[]
}

export interface MangleUserConfig {
  mangleClassFilter?: (className: string) => boolean
  classGenerator?: IClassGeneratorOptions
  exclude?: FilterPattern
  include?: FilterPattern
  classListPath?: string
  classMapOutput?: boolean | ClassMapOutputOptions | ((json: ClassMapOutputItem[]) => void)
  disabled?: boolean
  preserveFunction?: string[]
}

export interface TailwindcssV2PatchConfig {
  cwd?: string
  config?: string
}
export interface TailwindcssV3PatchConfig {
  cwd?: string
  config?: string
}

export interface TailwindcssV4PatchConfig {
  sources?: SourceEntry[]
  base?: string
  css?: string
  cssEntries?: string[]
}

export interface TailwindcssUserConfig {
  version?: 2 | 3 | 4
  // only support jit mode
  v2?: TailwindcssV2PatchConfig
  v3?: TailwindcssV3PatchConfig
  v4?: TailwindcssV4PatchConfig
}

export interface OutputUserConfig {
  filename?: string

  loose?: boolean
  /**
   * @description remove * in output json
   */
  removeUniversalSelector?: boolean
}

export interface PatchUserConfig {
  packageName?: string
  output?: OutputUserConfig
  tailwindcss?: TailwindcssUserConfig
  resolve?: PackageResolvingOptions
}

export interface UserConfig {
  patch?: PatchUserConfig
  mangle?: MangleUserConfig
}

import type { FilterPattern } from '@rollup/pluginutils'
import type { IClassGeneratorOptions } from '@tailwindcss-mangle/shared'

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

export interface GlobEntry {
  /** Base path of the glob */
  base?: string
  /** Glob pattern */
  pattern: string
}
export interface TailwindcssV4PatchConfig {
  sources?: GlobEntry[]
  base?: string
  css?: string
  cssEntries?: string[]
}

export interface PatchUserConfig {
  output?: {
    filename?: string

    loose?: boolean
    /**
     * @description remove * in output json
     */
    removeUniversalSelector?: boolean
  }
  tailwindcss?: {
    // only support jit mode
    v2?: TailwindcssV2PatchConfig
    v3?: TailwindcssV3PatchConfig
    v4?: TailwindcssV4PatchConfig
  }
}

export interface UserConfig {
  patch?: PatchUserConfig
  mangle?: MangleUserConfig
}

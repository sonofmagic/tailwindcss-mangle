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
    cwd?: string
    config?: string
  }
}

export interface UserConfig {
  patch?: PatchUserConfig
  mangle?: MangleUserConfig
}

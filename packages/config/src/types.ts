import type { IClassGeneratorOptions } from '@tailwindcss-mangle/shared'

export interface ClassMapOutputOptions {
  enable?: boolean
  filename?: string
  loose?: boolean
}

export interface MangleUserConfig {
  mangleClassFilter?: (className: string) => boolean
  classGenerator?: IClassGeneratorOptions
  exclude?: string[]
  include?: string[]
  classListPath?: string
  classMapOutput?: ClassMapOutputOptions
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

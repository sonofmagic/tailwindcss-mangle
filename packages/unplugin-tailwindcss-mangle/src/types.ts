import type { IClassGeneratorOptions } from '@tailwindcss-mangle/shared'

export interface ClassMapOutputOptions {
  filename: string
  dir?: string
}

export interface Options {
  mangleClassFilter?: (className: string) => boolean
  classGenerator?: IClassGeneratorOptions
  exclude?: string[]
  include?: string[]
  classListPath?: string
  classMapOutput?: boolean | ClassMapOutputOptions
  disabled?: boolean
}

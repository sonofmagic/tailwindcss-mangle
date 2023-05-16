import type { ClassGenerator } from 'tailwindcss-mangle-core'

export interface IClassGeneratorOptions {
  reserveClassName?: (string | RegExp)[]
  customGenerate?: (original: string, opts: IClassGeneratorOptions, context: Record<string, any>) => string | undefined
  log?: boolean
  exclude?: (string | RegExp)[]
  include?: (string | RegExp)[]
  ignoreClass?: (string | RegExp)[]
  classPrefix?: string
}

export interface IHandlerOptions {
  runtimeSet: Set<string>
  classGenerator: ClassGenerator
}

export interface ICssHandlerOptions extends IHandlerOptions {
  scene?: 'loader' | 'process'
}

export interface ClassSetOutputOptions {
  filename: string
  dir?: string
  type: 'all' | 'partial'
}

export interface ClassMapOutputOptions {
  filename: string
  dir?: string
}
export interface Options {
  mangleClassFilter?: (className: string) => boolean
  classGenerator?: IClassGeneratorOptions
  exclude?: string[]
  include?: string[]
  classSetOutput?: boolean | ClassSetOutputOptions
  classMapOutput?: boolean | ClassMapOutputOptions
}

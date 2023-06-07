import type {
  IHandlerOptions,
  IHtmlHandlerOptions, // as InternalHtmlHandlerOptions,
  IJsHandlerOptions, // as InternalJsHandlerOptions,
  ICssHandlerOptions // as InternalCssHandlerOptions
} from 'tailwindcss-mangle-core'

export interface IClassGeneratorOptions {
  reserveClassName?: (string | RegExp)[]
  customGenerate?: (original: string, opts: IClassGeneratorOptions, context: Record<string, any>) => string | undefined
  log?: boolean
  exclude?: (string | RegExp)[]
  include?: (string | RegExp)[]
  ignoreClass?: (string | RegExp)[]
  classPrefix?: string
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

export type PartialHandlerOptions<T extends IHandlerOptions> = Partial<Omit<T, 'runtimeSet' | 'classGenerator'>>

export interface Options {
  mangleClassFilter?: (className: string) => boolean
  classGenerator?: IClassGeneratorOptions
  exclude?: string[]
  include?: string[]
  classSetOutput?: boolean | ClassSetOutputOptions
  classMapOutput?: boolean | ClassMapOutputOptions
  htmlHandlerOptions?: PartialHandlerOptions<IHtmlHandlerOptions>
  jsHandlerOptions?: PartialHandlerOptions<IJsHandlerOptions>
  cssHandlerOptions?: PartialHandlerOptions<ICssHandlerOptions>
}

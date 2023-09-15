import type { Context } from './ctx'
export interface IClassGeneratorContextItem {
  name: string
  usedBy: string[]
}

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
  replaceMap: Map<string, string>
  ctx: Context
}

export interface IHtmlHandlerOptions extends IHandlerOptions {}

export interface IJsHandlerOptions extends IHandlerOptions {
  splitQuote?: boolean
  minified?: boolean
}

export interface ICssHandlerOptions extends IHandlerOptions {
  // scene?: 'loader' | 'process'
  ignoreVueScoped?: boolean
  file?: string
}

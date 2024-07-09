import type { TransformResult } from 'unplugin'
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

export interface IHandler {
  (code: string, options: IHandlerOptions): IHandlerTransformResult
}

export type IHandlerTransformResult = Exclude<TransformResult, null | undefined | string | void>

export interface IHandlerOptions {
  ctx: Context
  id?: string
}

export interface IHtmlHandlerOptions extends IHandlerOptions {

}

export interface IJsHandlerOptions extends IHandlerOptions {
  splitQuote?: boolean
}

export interface ICssHandlerOptions extends IHandlerOptions {
  ignoreVueScoped?: boolean
}

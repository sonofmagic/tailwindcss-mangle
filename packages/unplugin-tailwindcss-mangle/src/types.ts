import type ClassGenerator from './classGenerator'

export interface IMangleContextClass {
  name: string
  usedBy: any[]
}

export interface IMangleOptions {
  // classNameRegExp?: string
  reserveClassName?: (string | RegExp)[]
  // ignorePrefix?: string[]
  // ignorePrefixRegExp?: string
  customGenerate?: (original: string, opts: IMangleOptions, context: Record<string, any>) => string | undefined
  log?: boolean
  exclude?: (string | RegExp)[]
  include?: (string | RegExp)[]
  ignoreClass?: (string | RegExp)[]
  classPrefix?: string
}

export interface IClassGenerator {
  newClassMap: Record<string, IMangleContextClass>
  newClassSize: number
  context: Record<string, any>
}

export type { TraverseOptions } from '@babel/traverse'

export interface IHandlerOptions {
  runtimeSet: Set<string>
  classGenerator: ClassGenerator
}

export interface Options {
  classGenerator?: IMangleOptions
}

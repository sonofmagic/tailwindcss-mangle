import type ClassGenerator from './classGenerator'

export interface Options {
  // define your plugin options here
}

export interface IMangleContextClass {
  name: string
  usedBy: any[]
}

export interface IMangleOptions {
  // classNameRegExp?: string
  reserveClassName?: (string | RegExp)[]
  // ignorePrefix?: string[]
  // ignorePrefixRegExp?: string
  classGenerator?: (original: string, opts: IMangleOptions, context: Record<string, any>) => string | undefined
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

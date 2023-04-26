import type ClassGenerator from './classGenerator'

export interface IClassGeneratorContextItem {
  name: string
  usedBy: any[]
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

export interface IClassGenerator {
  newClassMap: Record<string, IClassGeneratorContextItem>
  newClassSize: number
  context: Record<string, any>
}

export type { TraverseOptions } from '@babel/traverse'

export interface IHandlerOptions {
  runtimeSet: Set<string>
  classGenerator: ClassGenerator
}

export interface Options {
  classGenerator?: IClassGeneratorOptions
  exclude?: string[]
  include?: string[]
}

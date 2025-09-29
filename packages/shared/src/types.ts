/* c8 ignore start */

export interface IClassGeneratorContextItem {
  name: string
  usedBy: Set<string>
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

/* c8 ignore end */

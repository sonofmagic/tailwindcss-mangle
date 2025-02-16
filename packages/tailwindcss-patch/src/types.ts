/* eslint-disable ts/no-unsafe-function-type */
import type { Node, Rule } from 'postcss'
import type { Config } from 'tailwindcss'

export type CacheStrategy = 'merge' | 'overwrite'

export interface PackageInfo {
  name: string
  version: string | undefined
  rootPath: string
  packageJsonPath: string
}

export interface CacheOptions {
  dir?: string
  cwd?: string
  file?: string
  strategy?: CacheStrategy
}

export interface InternalCacheOptions extends CacheOptions {
  enable?: boolean
}

export interface PatchOptions {
  overwrite?: boolean
  paths?: string[]
  basedir?: string
  applyPatches?: {
    exportContext?: boolean
    extendLengthUnits?: boolean | ILengthUnitsPatchOptions
  }
}

export interface InternalPatchOptions extends PatchOptions {
  version?: string
}

export interface TailwindcssPatcherOptions {
  cache?: CacheOptions | boolean
  patch?: PatchOptions
}

export type TailwindcssClassCache = Map<
  string,
  (
    | {
      layer: string
      options: Record<string, any>
      sort: Record<string, any>
    }
    | Rule
  )[]
>

export interface TailwindcssRuntimeContext {
  applyClassCache: Map<any, any>
  candidateRuleCache: Map<
    string,
    Set<
      [
        {
          arbitrary: any
          index: any
          layer: string
          options: any[]
          parallelIndex: any
          parentLayer: string
          variants: any
        },
        Node,
      ]
    >
  >
  candidateRuleMap: Map<string | string, [object, Node][]>
  changedContent: any[]
  classCache: TailwindcssClassCache
  disposables: any[]
  getClassList: Function
  getClassOrder: Function
  getVariants: Function
  markInvalidUtilityCandidate: Function
  markInvalidUtilityNode: Function
  notClassCache: Set<string>
  offsets: {
    layerPositions: object
    offsets: object
    reservedVariantBits: any
    variantOffsets: Map<string, any>
  }
  postCssNodeCache: Map<object, [Node]>
  ruleCache: Set<[object, Node]>
  stylesheetCache: Record<string, Set<any>>
  tailwindConfig: Config
  userConfigPath: string | null
  variantMap: Map<string, [[object, Function]]>
  variantOptions: Map<string, object>
}

// Custom utility type:
export type DeepRequired<T> = {
  [K in keyof T]: Required<DeepRequired<T[K]>>
}

export interface ILengthUnitsPatchOptions {
  units: string[]
  lengthUnitsFilePath?: string
  variableName?: string
  overwrite?: boolean
  destPath?: string
}

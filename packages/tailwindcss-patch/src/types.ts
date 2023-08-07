import type { Rule, Node } from 'postcss'
import type { Config } from 'tailwindcss'
export type CacheStrategy = 'merge' | 'overwrite'

export interface CacheOptions {
  // enable?: boolean
  dir?: string
  cwd?: string
  file?: string
  strategy?: CacheStrategy
}

export type InternalCacheOptions = CacheOptions & { enable?: boolean }

export interface PatchOptions {
  overwrite?: boolean
  paths?: string[]
  basedir?: string
  custom?: (dir: string, ctx: Record<string, any>) => void
}

export interface InternalPatchOptions {
  overwrite: boolean
  paths?: string[]
  basedir?: string
  custom?: (dir: string, ctx: Record<string, any>) => void
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

export type TailwindcssRuntimeContext = {
  applyClassCache: Map<any, any>
  candidateRuleCache: Map<
    string | String,
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
        Node
      ]
    >
  >
  candidateRuleMap: Map<string | String, [object, Node][]>
  changedContent: any[]
  classCache: TailwindcssClassCache
  disposables: any[]
  getClassList: Function
  getClassOrder: Function
  getVariants: Function
  markInvalidUtilityCandidate: Function
  markInvalidUtilityNode: Function
  notClassCache: Set<String>
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

export interface UserConfig {
  output?: {
    filename?: string

    loose?: boolean
    /**
     * @description remove * in output json
     */
    removeUniversalSelector?: boolean
  }
  tailwindcss?: {
    cwd?: string
    config?: string
  }
}
// Custom utility type:
export type DeepRequired<T> = {
  [K in keyof T]: Required<DeepRequired<T[K]>>
}

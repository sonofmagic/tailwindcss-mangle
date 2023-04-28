export interface CacheOptions {
  // enable?: boolean
  dir?: string
  cwd?: string
  file?: string
}

export type InternalCacheOptions = CacheOptions & { enable: boolean }

export interface PatchOptions {
  overwrite?: boolean
  paths?: string[]
  basedir?: string
  custom?: (dir: string, ctx: Record<string, any>) => void
  cache?: boolean | CacheOptions
}

export interface InternalPatchOptions {
  overwrite: boolean
  paths?: string[]
  basedir?: string
  custom?: (dir: string, ctx: Record<string, any>) => void
  cache?: CacheOptions
}

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
}

export interface TailwindcssPatcherOptions {
  cache?: CacheOptions | boolean
  patch?: PatchOptions
}

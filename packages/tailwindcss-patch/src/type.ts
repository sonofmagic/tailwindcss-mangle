export interface PatchOptions {
  overwrite?: boolean
  paths?: string[]
  basedir?: string,
  custom?: (dir: string, ctx: Record<string, any>) => void
}

export interface InternalPatchOptions {
  overwrite: boolean
  paths?: string[]
  basedir?: string
  custom?: (dir: string, ctx: Record<string, any>) => void
}

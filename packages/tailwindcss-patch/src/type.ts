export interface PatchOptions {
  overwrite?: boolean
  paths?: string[]
  basedir?: string
}

export interface InternalPatchOptions {
  overwrite: boolean
  paths?: string[]
  basedir?: string
}

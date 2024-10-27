import type { DeepRequired, InternalPatchOptions, PatchOptions } from './types'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'

export function getDefaultPatchOptions(): DeepRequired<PatchOptions> {
  return {
    applyPatches: {
      exportContext: true,
      extendLengthUnits: false,
    },
    overwrite: true,
  }
}

export function getPatchOptions(options?: PatchOptions) {
  return defu<InternalPatchOptions, Partial<InternalPatchOptions>[]>(
    options,
    {
      basedir: process.cwd(),
    },
    getDefaultPatchOptions(),
  )
}

import type { InternalPatchOptions, PatchOptions } from './types'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'

export function getDefaultPatchOptions() {
  return {
    packageName: 'tailwindcss',
    applyPatches: {
      exportContext: true,
      extendLengthUnits: false,
    },
    overwrite: true,
    filter: () => true,
  }
}

export function getPatchOptions(options?: PatchOptions) {
  return defu<InternalPatchOptions, Partial<InternalPatchOptions>[]>(
    options,
    {
      output: {
        removeUniversalSelector: true,
      },
      basedir: process.cwd(),
    },
    getDefaultPatchOptions(),
  )
}

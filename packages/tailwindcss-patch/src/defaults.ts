import process from 'node:process'
import { defu } from 'defu'
import type { DeepRequired, InternalPatchOptions, PatchOptions } from './types'

export function getDefaultPatchOptions(): DeepRequired<PatchOptions> {
  return {
    overwrite: true,
  }
}

export function getPatchOptions(options: PatchOptions = {}) {
  return defu(
    options,
    {
      basedir: process.cwd(),
    },
    getDefaultPatchOptions(),
  ) as InternalPatchOptions
}

import type { PatchOptions, DeepRequired } from './types'

export function getDefaultPatchOptions(): DeepRequired<PatchOptions> {
  return {
    overwrite: true
  }
}

import type { DeepRequired, PatchOptions } from './types'

export function getDefaultPatchOptions(): DeepRequired<PatchOptions> {
  return {
    overwrite: true,
  }
}

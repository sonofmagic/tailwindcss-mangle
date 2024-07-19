import path from 'node:path'
import { gte } from 'semver'
import type { PackageJson } from 'pkg-types'
import { monkeyPatchForExposingContextV2, monkeyPatchForExposingContextV3, monkeyPatchForSupportingCustomUnit } from './patches'

import type { InternalPatchOptions } from '@/types'

export function internalPatch(pkgJsonPath: string | undefined, options: InternalPatchOptions) {
  if (pkgJsonPath) {
    // eslint-disable-next-line ts/no-var-requires, ts/no-require-imports
    const pkgJson = require(pkgJsonPath) as PackageJson
    const twDir = path.dirname(pkgJsonPath)
    options.version = pkgJson.version
    if (gte(pkgJson.version!, '3.0.0')) {
      options.version = pkgJson.version

      if (options.applyPatches?.extendLengthUnits) {
        try {
          monkeyPatchForSupportingCustomUnit(twDir, {
            overwrite: options.overwrite,
          })
        }
        catch {

        }
      }

      if (options.applyPatches?.exportContext) {
        return monkeyPatchForExposingContextV3(twDir, options)
      }
    }
    else if (gte(pkgJson.version!, '2.0.0')) {
      if (options.applyPatches?.exportContext) {
        return monkeyPatchForExposingContextV2(twDir, options)
      }
    }
    // no sth
  }
}

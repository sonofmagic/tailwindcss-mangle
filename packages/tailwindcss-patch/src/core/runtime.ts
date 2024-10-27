import type { PackageJson } from 'pkg-types'
import type { ILengthUnitsPatchOptions, InternalPatchOptions } from '../types'
import { createRequire } from 'node:module'
import { defu } from '@tailwindcss-mangle/shared'
import path from 'pathe'
import { gte } from 'semver'
import { monkeyPatchForExposingContextV2, monkeyPatchForExposingContextV3, monkeyPatchForSupportingCustomUnit } from './patches'

const require = createRequire(import.meta.url)
export function internalPatch(pkgJsonPath: string | undefined, options: InternalPatchOptions) {
  if (pkgJsonPath) {
    const pkgJson = require(pkgJsonPath) as PackageJson
    const twDir = path.dirname(pkgJsonPath)
    options.version = pkgJson.version
    if (gte(pkgJson.version!, '3.0.0')) {
      let result: Record<string, any> | undefined = {}
      if (options.applyPatches?.exportContext) {
        result = monkeyPatchForExposingContextV3(twDir, options)
      }
      if (options.applyPatches?.extendLengthUnits) {
        try {
          Object.assign(result ?? {}, monkeyPatchForSupportingCustomUnit(twDir, defu<Partial<ILengthUnitsPatchOptions>, Partial<ILengthUnitsPatchOptions>[]>(options.applyPatches.extendLengthUnits === true ? undefined : options.applyPatches.extendLengthUnits, {
            overwrite: options.overwrite,
          })))
        }
        catch {

        }
      }
      return result
    }
    else if (gte(pkgJson.version!, '2.0.0')) {
      if (options.applyPatches?.exportContext) {
        return monkeyPatchForExposingContextV2(twDir, options)
      }
    }
    // no sth
  }
}

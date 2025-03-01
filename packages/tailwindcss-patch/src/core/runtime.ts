import type { PackageInfo } from 'local-pkg'
import type { PackageJson } from 'pkg-types'
import type { ILengthUnitsPatchOptions, InternalPatchOptions } from '../types'
import { createRequire } from 'node:module'
import { defu } from '@tailwindcss-mangle/shared'
import path from 'pathe'
import { gte } from 'semver'
import { monkeyPatchForExposingContextV2, monkeyPatchForExposingContextV3, monkeyPatchForSupportingCustomUnitV3, monkeyPatchForSupportingCustomUnitV4 } from './patches'

const require = createRequire(import.meta.url)

export function internalPatch(pkgJsonPath: PackageInfo, options: InternalPatchOptions): any
export function internalPatch(pkgJsonPath: string, options: InternalPatchOptions): any
export function internalPatch(pkgJsonPath: PackageInfo | string, options: InternalPatchOptions) {
  if (pkgJsonPath) {
    let pkgJson: PackageJson
    let twDir: string
    if (typeof pkgJsonPath === 'string') {
      pkgJson = require(pkgJsonPath) as PackageJson
      twDir = path.dirname(pkgJsonPath)
      options.version = pkgJson.version
    }
    else if (typeof pkgJsonPath === 'object') {
      pkgJson = pkgJsonPath.packageJson
      twDir = pkgJsonPath.rootPath
      options.version = pkgJsonPath.version
    }
    else {
      throw new TypeError('tailwindcss not found')
    }
    if (gte(pkgJson.version!, '4.0.0')) {
      try {
        if (options.applyPatches?.extendLengthUnits) {
          return monkeyPatchForSupportingCustomUnitV4(twDir, options)
        }
      }
      catch {

      }
    }
    else if (gte(pkgJson.version!, '3.0.0')) {
      let result: Record<string, any> | undefined = {}
      if (options.applyPatches?.exportContext) {
        result = monkeyPatchForExposingContextV3(twDir, options)
      }
      if (options.applyPatches?.extendLengthUnits) {
        try {
          Object.assign(result ?? {}, monkeyPatchForSupportingCustomUnitV3(twDir, defu<Partial<ILengthUnitsPatchOptions>, Partial<ILengthUnitsPatchOptions>[]>(options.applyPatches.extendLengthUnits === true ? undefined : options.applyPatches.extendLengthUnits, {
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

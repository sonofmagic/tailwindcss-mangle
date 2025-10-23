import type { PackageInfo } from 'local-pkg'
import type { NormalizedTailwindcssPatchOptions } from '../options/types'
import { applyExposeContextPatch } from './operations/export-context'
import { applyExtendLengthUnitsPatchV3, applyExtendLengthUnitsPatchV4 } from './operations/extend-length-units'

export interface PatchRunnerContext {
  packageInfo: PackageInfo
  options: NormalizedTailwindcssPatchOptions
  majorVersion: 2 | 3 | 4
}

export interface PatchRunnerResult {
  exposeContext?: ReturnType<typeof applyExposeContextPatch>
  extendLengthUnits?: ReturnType<typeof applyExtendLengthUnitsPatchV3> | ReturnType<typeof applyExtendLengthUnitsPatchV4>
}

export function applyTailwindPatches(context: PatchRunnerContext): PatchRunnerResult {
  const { packageInfo, options, majorVersion } = context
  const results: PatchRunnerResult = {}

  if (options.features.exposeContext.enabled && (majorVersion === 2 || majorVersion === 3)) {
    results.exposeContext = applyExposeContextPatch({
      rootDir: packageInfo.rootPath,
      refProperty: options.features.exposeContext.refProperty,
      overwrite: options.overwrite,
      majorVersion,
    })
  }

  if (options.features.extendLengthUnits?.enabled) {
    if (majorVersion === 3) {
      results.extendLengthUnits = applyExtendLengthUnitsPatchV3(
        packageInfo.rootPath,
        options.features.extendLengthUnits,
      )
    }
    else if (majorVersion === 4) {
      results.extendLengthUnits = applyExtendLengthUnitsPatchV4(
        packageInfo.rootPath,
        options.features.extendLengthUnits,
      )
    }
  }

  return results
}

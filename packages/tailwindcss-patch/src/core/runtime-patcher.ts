import path from 'node:path'
import { gte } from 'semver'
import type { PackageJson } from 'pkg-types'
import { monkeyPatchForExposingContextV2, monkeyPatchForExposingContextV3, monkeyPatchForSupportingCustomUnit } from './patches'

import type { InternalPatchOptions } from '@/types'

export function internalPatch(pkgJsonPath: string | undefined, options: InternalPatchOptions): any | undefined {
  if (pkgJsonPath) {
    // eslint-disable-next-line ts/no-var-requires, ts/no-require-imports
    const pkgJson = require(pkgJsonPath) as PackageJson
    const twDir = path.dirname(pkgJsonPath)
    if (gte(pkgJson.version!, '3.0.0')) {
      options.version = pkgJson.version
      monkeyPatchForSupportingCustomUnit(twDir, {
        units: ['rpx'],
        dangerousOptions: {
          lengthUnitsFilePath: 'lib/util/dataTypes.js',
          variableName: 'lengthUnits',
          overwrite: true,
        },
      })
      const result = monkeyPatchForExposingContextV3(twDir, options)
      return result
    }
    else if (gte(pkgJson.version!, '2.0.0')) {
      options.version = pkgJson.version
      const result = monkeyPatchForExposingContextV2(twDir, options)
      return result
    }
    // no sth
  }
}

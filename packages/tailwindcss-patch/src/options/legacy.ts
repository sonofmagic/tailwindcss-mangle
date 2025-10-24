import type { PatchUserConfig } from '@tailwindcss-mangle/config'
import type { PackageResolvingOptions } from 'local-pkg'
import type { TailwindcssPatchOptions, ExtendLengthUnitsUserOptions } from './types'
import type { ILengthUnitsPatchOptions } from '../types'

export interface LegacyCacheOptions {
  dir?: string
  cwd?: string
  file?: string
  strategy?: 'merge' | 'overwrite'
  enabled?: boolean
}

export interface LegacyPatchOptions extends PatchUserConfig {
  overwrite?: boolean
  applyPatches?: {
    exportContext?: boolean
    extendLengthUnits?: boolean | ILengthUnitsPatchOptions
  }
  filter?: (className: string) => boolean
  cwd?: string
  resolve?: PackageResolvingOptions
}

export interface LegacyTailwindcssPatcherOptions {
  cache?: LegacyCacheOptions | boolean
  patch?: LegacyPatchOptions
}

function normalizeLegacyFeatures(patch: LegacyPatchOptions | undefined): {
  exposeContext: boolean
  extendLengthUnits: false | ExtendLengthUnitsUserOptions
} {
  const apply = patch?.applyPatches
  const extend = apply?.extendLengthUnits
  let extendOption: false | ExtendLengthUnitsUserOptions = false

  if (extend && typeof extend === 'object') {
    extendOption = {
      ...extend,
      enabled: true,
    }
  }
  else if (extend === true) {
    extendOption = {
      enabled: true,
      units: ['rpx'],
      overwrite: patch?.overwrite,
    }
  }

  return {
    exposeContext: apply?.exportContext ?? true,
    extendLengthUnits: extendOption,
  }
}

export function fromLegacyOptions(options?: LegacyTailwindcssPatcherOptions): TailwindcssPatchOptions {
  if (!options) {
    return {}
  }

  const patch = options.patch
  const features = normalizeLegacyFeatures(patch)
  const output = patch?.output

  const tailwindConfig = patch?.tailwindcss
  const tailwindVersion = tailwindConfig?.version as 2 | 3 | 4 | undefined
  const tailwindV2 = tailwindConfig?.v2
  const tailwindV3 = tailwindConfig?.v3
  const tailwindV4 = tailwindConfig?.v4

  const tailwindConfigPath = tailwindV3?.config ?? tailwindV2?.config
  const tailwindCwd = tailwindV3?.cwd ?? tailwindV2?.cwd ?? patch?.cwd
  return {
    cwd: patch?.cwd,
    overwrite: patch?.overwrite,
    filter: patch?.filter,
    cache: typeof options.cache === 'boolean'
      ? options.cache
      : options.cache
        ? {
            ...options.cache,
            enabled: options.cache.enabled ?? true,
          }
        : undefined,
    output: output
      ? {
          file: output.filename,
          pretty: output.loose ? 2 : false,
          removeUniversalSelector: output.removeUniversalSelector,
        }
      : undefined,
    tailwind: {
      packageName: patch?.packageName,
      version: tailwindVersion,
      resolve: patch?.resolve,
      config: tailwindConfigPath,
      cwd: tailwindCwd,
      v2: tailwindV2,
      v3: tailwindV3,
      v4: tailwindV4,
    },
    features: {
      exposeContext: features.exposeContext,
      extendLengthUnits: features.extendLengthUnits,
    },
  }
}

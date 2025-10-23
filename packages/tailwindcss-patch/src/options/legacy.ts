import type { PatchUserConfig } from '@tailwindcss-mangle/config'
import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'
import type { TailwindcssPatchOptions } from './types'
import type { ILengthUnitsPatchOptions } from '../types'

export interface LegacyCacheOptions {
  dir?: string
  cwd?: string
  file?: string
  strategy?: 'merge' | 'overwrite'
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

function normalizeLegacyFeatures(patch: LegacyPatchOptions | undefined) {
  const apply = patch?.applyPatches
  const extend = apply?.extendLengthUnits
  let extendOption: false | ILengthUnitsPatchOptions = false

  if (extend && typeof extend === 'object') {
    extendOption = extend
  }
  else if (extend === true) {
    extendOption = {
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

  let extendLengthUnits: false | { units: string[], overwrite?: boolean } | Partial<ILengthUnitsPatchOptions> = features.extendLengthUnits
  if (extendLengthUnits && extendLengthUnits !== false && typeof extendLengthUnits !== 'object') {
    extendLengthUnits = {
      units: ['rpx'],
      overwrite: patch?.overwrite,
    }
  }

  return {
    cwd: patch?.cwd,
    overwrite: patch?.overwrite,
    filter: patch?.filter,
    cache: typeof options.cache === 'boolean'
      ? options.cache
      : options.cache
        ? {
            enabled: true,
            ...options.cache,
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
      version: patch?.tailwindcss?.version as 2 | 3 | 4 | undefined,
      resolve: patch?.resolve,
      config: patch?.tailwindcss?.config ?? patch?.tailwindcss?.v3?.config ?? patch?.tailwindcss?.v2?.config,
      cwd: patch?.tailwindcss?.cwd ?? patch?.tailwindcss?.v3?.cwd ?? patch?.tailwindcss?.v2?.cwd,
      postcssPlugin: patch?.tailwindcss?.postcssPlugin,
      v2: patch?.tailwindcss?.v2,
      v3: patch?.tailwindcss?.v3,
      v4: patch?.tailwindcss?.v4,
    },
    features: {
      exposeContext: features.exposeContext,
      extendLengthUnits: extendLengthUnits || false,
    },
  }
}

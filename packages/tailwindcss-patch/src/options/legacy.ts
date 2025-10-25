import type {
  RegistryOptions,
  TailwindLocatorOptions,
  TailwindNextOptions,
} from '@tailwindcss-mangle/config'
import type { PackageResolvingOptions } from 'local-pkg'
import type { ILengthUnitsPatchOptions } from '../types'
import type { ExtendLengthUnitsUserOptions, TailwindcssPatchOptions } from './types'

export interface LegacyCacheOptions {
  dir?: string
  cwd?: string
  file?: string
  strategy?: 'merge' | 'overwrite'
  enabled?: boolean
}

export interface LegacyOutputOptions {
  filename?: string
  loose?: boolean
  removeUniversalSelector?: boolean
}

export interface LegacyTailwindcssOptions {
  version?: 2 | 3 | 4
  v2?: TailwindLocatorOptions
  v3?: TailwindLocatorOptions
  v4?: TailwindNextOptions
  config?: string
  cwd?: string
}

export interface LegacyPatchOptions {
  packageName?: string
  output?: LegacyOutputOptions
  tailwindcss?: LegacyTailwindcssOptions
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

export function fromUnifiedConfig(registry?: RegistryOptions): TailwindcssPatchOptions {
  if (!registry) {
    return {}
  }

  const tailwind = registry.tailwind
  const output = registry.output

  const pretty = (() => {
    if (output?.pretty === undefined) {
      return undefined
    }
    if (typeof output.pretty === 'boolean') {
      return output.pretty ? 2 : false
    }
    return output.pretty
  })()

  return {
    output: output
      ? {
          file: output.file,
          pretty,
          removeUniversalSelector: output.stripUniversalSelector,
        }
      : undefined,
    tailwind: tailwind
      ? {
          version: tailwind.version,
          packageName: tailwind.package,
          resolve: tailwind.resolve,
          config: tailwind.config,
          cwd: tailwind.cwd,
          v2: tailwind.legacy,
          v3: tailwind.classic,
          v4: tailwind.next,
        }
      : undefined,
  }
}

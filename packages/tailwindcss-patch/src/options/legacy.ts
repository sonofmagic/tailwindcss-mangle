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
      ...(patch?.overwrite === undefined ? {} : { overwrite: patch.overwrite }),
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
  const normalizedExtract = output
    ? {
        ...(output.filename === undefined ? {} : { file: output.filename }),
        pretty: output.loose ? 2 : false,
        ...(output.removeUniversalSelector === undefined ? {} : { removeUniversalSelector: output.removeUniversalSelector }),
      }
    : undefined
  const normalizedTailwindcss = {
    ...(patch?.packageName === undefined ? {} : { packageName: patch.packageName }),
    ...(tailwindVersion === undefined ? {} : { version: tailwindVersion }),
    ...(patch?.resolve === undefined ? {} : { resolve: patch.resolve }),
    ...(tailwindConfigPath === undefined ? {} : { config: tailwindConfigPath }),
    ...(tailwindCwd === undefined ? {} : { cwd: tailwindCwd }),
    ...(tailwindV2 === undefined ? {} : { v2: tailwindV2 }),
    ...(tailwindV3 === undefined ? {} : { v3: tailwindV3 }),
    ...(tailwindV4 === undefined ? {} : { v4: tailwindV4 }),
  }
  const normalizedCache = typeof options.cache === 'boolean'
    ? options.cache
    : options.cache
      ? {
          ...options.cache,
          enabled: options.cache.enabled ?? true,
        }
      : undefined
  const normalizedApply = {
    ...(patch?.overwrite === undefined ? {} : { overwrite: patch.overwrite }),
    exposeContext: features.exposeContext,
    extendLengthUnits: features.extendLengthUnits,
  }

  return {
    ...(patch?.cwd === undefined ? {} : { projectRoot: patch.cwd }),
    ...(patch?.filter === undefined ? {} : { filter: patch.filter }),
    ...(normalizedCache === undefined ? {} : { cache: normalizedCache }),
    ...(normalizedExtract === undefined ? {} : { extract: normalizedExtract }),
    ...(Object.keys(normalizedTailwindcss).length === 0 ? {} : { tailwindcss: normalizedTailwindcss }),
    apply: normalizedApply,
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
  const normalizedExtract = output
    ? {
        ...(output.file === undefined ? {} : { file: output.file }),
        ...(pretty === undefined ? {} : { pretty }),
        ...(output.stripUniversalSelector === undefined ? {} : { removeUniversalSelector: output.stripUniversalSelector }),
      }
    : undefined
  const normalizedTailwindcss = tailwind
    ? {
        ...(tailwind.version === undefined ? {} : { version: tailwind.version }),
        ...(tailwind.package === undefined ? {} : { packageName: tailwind.package }),
        ...(tailwind.resolve === undefined ? {} : { resolve: tailwind.resolve }),
        ...(tailwind.config === undefined ? {} : { config: tailwind.config }),
        ...(tailwind.cwd === undefined ? {} : { cwd: tailwind.cwd }),
        ...(tailwind.legacy === undefined ? {} : { v2: tailwind.legacy }),
        ...(tailwind.classic === undefined ? {} : { v3: tailwind.classic }),
        ...(tailwind.next === undefined ? {} : { v4: tailwind.next }),
      }
    : undefined

  return {
    ...(normalizedExtract === undefined ? {} : { extract: normalizedExtract }),
    ...(normalizedTailwindcss === undefined ? {} : { tailwindcss: normalizedTailwindcss }),
  }
}

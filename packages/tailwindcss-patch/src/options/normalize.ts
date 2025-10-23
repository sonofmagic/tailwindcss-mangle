import process from 'node:process'
import path from 'pathe'
import type {
  NormalizedCacheOptions,
  NormalizedFeatureOptions,
  NormalizedOutputOptions,
  NormalizedTailwindConfigOptions,
  NormalizedTailwindV4Options,
  NormalizedTailwindcssPatchOptions,
  TailwindcssPatchOptions,
  TailwindUserOptions,
  TailwindV4UserOptions,
} from './types'
import type { CacheStrategy, ExtendLengthUnitsUserOptions, FeatureUserOptions, OutputUserOptions } from './types'
import type { ILengthUnitsPatchOptions } from '../types'
import { pkgName } from '../constants'

function toPrettyValue(value: OutputUserOptions['pretty']): number | false {
  if (typeof value === 'number') {
    return value > 0 ? value : false
  }
  if (value === true) {
    return 2
  }
  return false
}

function normalizeCacheOptions(
  cache: TailwindcssPatchOptions['cache'],
  projectRoot: string,
): NormalizedCacheOptions {
  let enabled = false
  let cwd = projectRoot
  let dir = path.resolve(cwd, 'node_modules/.cache', pkgName)
  let file = 'class-cache.json'
  let strategy: CacheStrategy = 'merge'

  if (typeof cache === 'boolean') {
    enabled = cache
  }
  else if (typeof cache === 'object' && cache) {
    enabled = cache.enabled ?? true
    cwd = cache.cwd ?? cwd
    dir = cache.dir ? path.resolve(cache.dir) : path.resolve(cwd, 'node_modules/.cache', pkgName)
    file = cache.file ?? file
    strategy = cache.strategy ?? strategy
  }

  const filename = path.resolve(dir, file)

  return {
    enabled,
    cwd,
    dir,
    file,
    path: filename,
    strategy,
  }
}

function normalizeOutputOptions(output: OutputUserOptions | undefined): NormalizedOutputOptions {
  const enabled = output?.enabled ?? true
  const file = output?.file ?? '.tw-patch/tw-class-list.json'
  const format = output?.format ?? 'json'
  const pretty = toPrettyValue(output?.pretty ?? true)
  const removeUniversalSelector = output?.removeUniversalSelector ?? true

  return {
    enabled,
    file,
    format,
    pretty,
    removeUniversalSelector,
  }
}

function normalizeExposeContextOptions(features: FeatureUserOptions | undefined): NormalizedFeatureOptions['exposeContext'] {
  if (features?.exposeContext === false) {
    return {
      enabled: false,
      refProperty: 'contextRef',
    }
  }

  if (typeof features?.exposeContext === 'object' && features.exposeContext) {
    return {
      enabled: true,
      refProperty: features.exposeContext.refProperty ?? 'contextRef',
    }
  }

  return {
    enabled: true,
    refProperty: 'contextRef',
  }
}

function normalizeExtendLengthUnitsOptions(features: FeatureUserOptions | undefined): NormalizedFeatureOptions['extendLengthUnits'] {
  const extend = features?.extendLengthUnits
  if (!extend || extend === false) {
    return null
  }

  const base: ILengthUnitsPatchOptions = {
    units: ['rpx'],
    overwrite: true,
  }

  const options: ExtendLengthUnitsUserOptions = typeof extend === 'boolean' ? { enabled: true } : extend

  return {
    ...base,
    ...options,
    enabled: options.enabled ?? true,
    units: options.units ?? base.units,
    overwrite: options.overwrite ?? base.overwrite!,
  }
}

function normalizeTailwindV4Options(
  v4: TailwindV4UserOptions | undefined,
  fallbackBase: string,
): NormalizedTailwindV4Options {
  const base = v4?.base ? path.resolve(v4.base) : fallbackBase
  const cssEntries = Array.isArray(v4?.cssEntries)
    ? v4!.cssEntries.filter((entry): entry is string => Boolean(entry)).map(entry => path.resolve(entry))
    : []
  const sources = v4?.sources?.length
    ? v4.sources
    : [
        {
          base,
          pattern: '**/*',
          negated: false,
        },
      ]

  return {
    base,
    css: v4?.css,
    cssEntries,
    sources,
  }
}

function normalizeTailwindOptions(
  tailwind: TailwindUserOptions | undefined,
  projectRoot: string,
): NormalizedTailwindConfigOptions {
  const packageName = tailwind?.packageName ?? 'tailwindcss'
  const versionHint = tailwind?.version
  const resolve = tailwind?.resolve

  const cwd = tailwind?.cwd ?? projectRoot
  const config = tailwind?.config
  const postcssPlugin = tailwind?.postcssPlugin

  const v4 = normalizeTailwindV4Options(tailwind?.v4, cwd)

  return {
    packageName,
    versionHint,
    resolve,
    cwd,
    config,
    postcssPlugin,
    v2: tailwind?.v2,
    v3: tailwind?.v3,
    v4,
  }
}

export function normalizeOptions(options: TailwindcssPatchOptions = {}): NormalizedTailwindcssPatchOptions {
  const projectRoot = options.cwd ? path.resolve(options.cwd) : process.cwd()
  const overwrite = options.overwrite ?? true

  const output = normalizeOutputOptions(options.output)
  const cache = normalizeCacheOptions(options.cache, projectRoot)
  const tailwind = normalizeTailwindOptions(options.tailwind, projectRoot)
  const exposeContext = normalizeExposeContextOptions(options.features)
  const extendLengthUnits = normalizeExtendLengthUnitsOptions(options.features)

  const filter = (className: string) => {
    if (output.removeUniversalSelector && className === '*') {
      return false
    }

    if (typeof options.filter === 'function') {
      return options.filter(className) !== false
    }
    return true
  }

  return {
    projectRoot,
    overwrite,
    tailwind,
    features: {
      exposeContext,
      extendLengthUnits,
    },
    output,
    cache,
    filter,
  }
}

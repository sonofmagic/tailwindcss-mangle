import type { ILengthUnitsPatchOptions } from '../types'
import type {
  CacheDriver,
  CacheStrategy,
  NormalizedCacheOptions,
  NormalizedFeatureOptions,
  NormalizedOutputOptions,
  NormalizedTailwindConfigOptions,
  NormalizedTailwindcssPatchOptions,
  NormalizedTailwindV4Options,
  PatchApplyUserOptions,
  TailwindcssPatchOptions,
  TailwindcssUserOptions,
  TailwindExtractionUserOptions,
  TailwindV4RuntimeUserOptions,
} from './types'
import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { pkgName } from '../constants'

function resolveRealpathSafe(value: string) {
  const resolved = path.resolve(value)
  try {
    return path.normalize(fs.realpathSync(resolved))
  }
  catch {
    return path.normalize(resolved)
  }
}

function toPrettyValue(value: TailwindExtractionUserOptions['pretty']): number | false {
  if (typeof value === 'number') {
    return value > 0 ? value : false
  }
  if (value === true) {
    return 2
  }
  return false
}

function normalizeCacheDriver(driver: CacheDriver | undefined): CacheDriver {
  if (driver === 'memory' || driver === 'noop') {
    return driver
  }
  return 'file'
}

function normalizeCacheOptions(
  cache: TailwindcssPatchOptions['cache'],
  projectRoot: string,
): NormalizedCacheOptions {
  let enabled = false
  let cwd = resolveRealpathSafe(projectRoot)
  let dir = path.resolve(cwd, 'node_modules/.cache', pkgName)
  let file = 'class-cache.json'
  let strategy: CacheStrategy = 'merge'
  let driver: CacheDriver = 'file'

  if (typeof cache === 'boolean') {
    enabled = cache
  }
  else if (typeof cache === 'object' && cache) {
    enabled = cache.enabled ?? true
    cwd = cache.cwd ? resolveRealpathSafe(cache.cwd) : cwd
    dir = cache.dir ? path.resolve(cache.dir) : path.resolve(cwd, 'node_modules/.cache', pkgName)
    file = cache.file ?? file
    strategy = cache.strategy ?? strategy
    driver = normalizeCacheDriver(cache.driver)
  }

  const filename = path.resolve(dir, file)

  return {
    enabled,
    cwd,
    dir,
    file,
    path: filename,
    strategy,
    driver,
  }
}

function normalizeOutputOptions(output: TailwindExtractionUserOptions | undefined): NormalizedOutputOptions {
  const enabled = output?.write ?? true
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

function normalizeExposeContextOptions(exposeContext: PatchApplyUserOptions['exposeContext'] | undefined): NormalizedFeatureOptions['exposeContext'] {
  if (exposeContext === false) {
    return {
      enabled: false,
      refProperty: 'contextRef',
    }
  }

  if (typeof exposeContext === 'object' && exposeContext) {
    return {
      enabled: true,
      refProperty: exposeContext.refProperty ?? 'contextRef',
    }
  }

  return {
    enabled: true,
    refProperty: 'contextRef',
  }
}

function normalizeExtendLengthUnitsOptions(extend: PatchApplyUserOptions['extendLengthUnits'] | undefined): NormalizedFeatureOptions['extendLengthUnits'] {
  if (extend === false || extend === undefined) {
    return null
  }

  if (extend.enabled === false) {
    return null
  }

  const base: ILengthUnitsPatchOptions = {
    units: ['rpx'],
    overwrite: true,
  }

  return {
    ...base,
    ...extend,
    enabled: extend.enabled ?? true,
    units: extend.units ?? base.units,
    overwrite: extend.overwrite ?? base.overwrite!,
  }
}

function normalizeTailwindV4Options(
  v4: TailwindV4RuntimeUserOptions | undefined,
  fallbackBase: string,
): NormalizedTailwindV4Options {
  const configuredBase = v4?.base ? path.resolve(v4.base) : undefined
  const base = configuredBase ?? fallbackBase
  const cssEntries = Array.isArray(v4?.cssEntries)
    ? v4!.cssEntries.filter((entry): entry is string => Boolean(entry)).map(entry => path.resolve(entry))
    : []
  const userSources = v4?.sources
  const hasUserDefinedSources = Boolean(userSources?.length)
  const sources: NormalizedTailwindV4Options['sources'] = hasUserDefinedSources
    ? userSources!
    : [
        {
          base: fallbackBase,
          pattern: '**/*',
          negated: false,
        },
      ]

  return {
    base,
    ...(configuredBase === undefined ? {} : { configuredBase }),
    ...(v4?.css === undefined ? {} : { css: v4.css }),
    cssEntries,
    sources,
    hasUserDefinedSources,
  }
}

function normalizeTailwindOptions(
  tailwind: TailwindcssUserOptions | undefined,
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
    cwd,
    ...(versionHint === undefined ? {} : { versionHint }),
    ...(resolve === undefined ? {} : { resolve }),
    ...(config === undefined ? {} : { config }),
    ...(postcssPlugin === undefined ? {} : { postcssPlugin }),
    ...(tailwind?.v2 === undefined ? {} : { v2: tailwind.v2 }),
    ...(tailwind?.v3 === undefined ? {} : { v3: tailwind.v3 }),
    v4,
  }
}

const deprecatedOptionMapping = {
  cwd: 'projectRoot',
  overwrite: 'apply.overwrite',
  tailwind: 'tailwindcss',
  features: 'apply',
  output: 'extract',
} as const

type DeprecatedTopLevelOptionKey = keyof typeof deprecatedOptionMapping

function assertNoDeprecatedOptions(options: TailwindcssPatchOptions) {
  const used = (Object.keys(deprecatedOptionMapping) as DeprecatedTopLevelOptionKey[])
    .filter(key => Object.prototype.hasOwnProperty.call(options, key))

  if (used.length === 0) {
    return
  }

  const mapping = used.map(key => `${key} -> ${deprecatedOptionMapping[key]}`).join(', ')
  throw new Error(
    `Legacy TailwindcssPatcher options are no longer supported: ${used.join(', ')}. Use the modern fields instead: ${mapping}.`,
  )
}

export function normalizeOptions(options: TailwindcssPatchOptions = {}): NormalizedTailwindcssPatchOptions {
  assertNoDeprecatedOptions(options)

  const projectRoot = resolveRealpathSafe(options.projectRoot ? path.resolve(options.projectRoot) : process.cwd())
  const overwrite = options.apply?.overwrite ?? true

  const output = normalizeOutputOptions(options.extract)
  const cache = normalizeCacheOptions(options.cache, projectRoot)
  const tailwind = normalizeTailwindOptions(options.tailwindcss, projectRoot)
  const exposeContext = normalizeExposeContextOptions(options.apply?.exposeContext)
  const extendLengthUnits = normalizeExtendLengthUnitsOptions(options.apply?.extendLengthUnits)

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

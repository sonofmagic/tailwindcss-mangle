import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageInfo } from 'local-pkg'
import type { LegacyTailwindcssPatcherOptions } from '../options/legacy'
import type { NormalizedTailwindcssPatchOptions } from '../options/types'
import type {
  CacheClearOptions,
  CacheClearResult,
  CacheReadMeta,
  CacheContextMetadata,
  ExtractResult,
  TailwindcssPatchOptions,
  TailwindTokenByFileMap,
  TailwindTokenFileKey,
  TailwindTokenReport,
} from '../types'
import process from 'node:process'
import fs from 'fs-extra'
import { getPackageInfoSync } from 'local-pkg'
import path from 'pathe'
import { coerce } from 'semver'
import { CacheStore } from '../cache/store'
import { createCacheContextDescriptor } from '../cache/context'
import {
  extractValidCandidates as extractCandidates,
  extractProjectCandidatesWithPositions,
  groupTokensByFile,
} from '../extraction/candidate-extractor'
import logger from '../logger'
import { fromLegacyOptions } from '../options/legacy'
import { normalizeOptions } from '../options/normalize'
import { applyTailwindPatches } from '../patching/patch-runner'
import { getPatchStatusReport } from '../patching/status'
import { collectClassesFromContexts, collectClassesFromTailwindV4 } from '../runtime/class-collector'
import { loadRuntimeContexts } from '../runtime/context-registry'
import { runTailwindBuild } from '../runtime/process-tailwindcss'

type TailwindMajorVersion = 2 | 3 | 4

function resolveMajorVersion(version?: string | null, hint?: 2 | 3 | 4): TailwindMajorVersion {
  if (hint && [2, 3, 4].includes(hint)) {
    return hint
  }

  if (version) {
    const coerced = coerce(version)
    if (coerced) {
      const major = coerced.major as TailwindMajorVersion
      if (major === 2 || major === 3 || major === 4) {
        return major
      }
      if (major >= 4) {
        return 4
      }
    }
  }

  return 3
}

function resolveTailwindExecutionOptions(
  normalized: NormalizedTailwindcssPatchOptions,
  majorVersion: TailwindMajorVersion,
) {
  const base = normalized.tailwind
  if (majorVersion === 2 && base.v2) {
    return {
      cwd: base.v2.cwd ?? base.cwd ?? normalized.projectRoot,
      config: base.v2.config ?? base.config,
      postcssPlugin: base.v2.postcssPlugin ?? base.postcssPlugin,
    }
  }

  if (majorVersion === 3 && base.v3) {
    return {
      cwd: base.v3.cwd ?? base.cwd ?? normalized.projectRoot,
      config: base.v3.config ?? base.config,
      postcssPlugin: base.v3.postcssPlugin ?? base.postcssPlugin,
    }
  }

  return {
    cwd: base.cwd ?? normalized.projectRoot,
    config: base.config,
    postcssPlugin: base.postcssPlugin,
  }
}

type TailwindcssPatcherInitOptions = TailwindcssPatchOptions | LegacyTailwindcssPatcherOptions

export class TailwindcssPatcher {
  public readonly options: NormalizedTailwindcssPatchOptions
  public readonly packageInfo: PackageInfo
  public readonly majorVersion: TailwindMajorVersion

  private readonly cacheContext: {
    fingerprint: string
    metadata: CacheContextMetadata
  }
  private readonly cacheStore: CacheStore

  constructor(options: TailwindcssPatcherInitOptions = {}) {
    const resolvedOptions: TailwindcssPatchOptions
      = options && typeof options === 'object' && 'patch' in options
        ? fromLegacyOptions(options as LegacyTailwindcssPatcherOptions)
        : (options as TailwindcssPatchOptions)

    this.options = normalizeOptions(resolvedOptions)
    const packageInfo = getPackageInfoSync(
      this.options.tailwind.packageName,
      this.options.tailwind.resolve,
    )

    if (!packageInfo) {
      throw new Error(`Unable to locate Tailwind CSS package "${this.options.tailwind.packageName}".`)
    }

    this.packageInfo = packageInfo as PackageInfo
    this.majorVersion = resolveMajorVersion(
      this.packageInfo.version,
      this.options.tailwind.versionHint,
    )

    this.cacheContext = createCacheContextDescriptor(
      this.options,
      this.packageInfo,
      this.majorVersion,
    )
    this.cacheStore = new CacheStore(this.options.cache, this.cacheContext)
  }

  async patch() {
    return applyTailwindPatches({
      packageInfo: this.packageInfo,
      options: this.options,
      majorVersion: this.majorVersion,
    })
  }

  async getPatchStatus() {
    return getPatchStatusReport({
      packageInfo: this.packageInfo,
      options: this.options,
      majorVersion: this.majorVersion,
    })
  }

  getContexts() {
    return loadRuntimeContexts(
      this.packageInfo,
      this.majorVersion,
      this.options.features.exposeContext.refProperty,
    )
  }

  private async runTailwindBuildIfNeeded() {
    if (this.majorVersion === 2 || this.majorVersion === 3) {
      const executionOptions = resolveTailwindExecutionOptions(this.options, this.majorVersion)
      const buildOptions = {
        cwd: executionOptions.cwd,
        majorVersion: this.majorVersion,
        ...(executionOptions.config === undefined ? {} : { config: executionOptions.config }),
        ...(executionOptions.postcssPlugin === undefined ? {} : { postcssPlugin: executionOptions.postcssPlugin }),
      }
      await runTailwindBuild(buildOptions)
    }
  }

  private async collectClassSet(): Promise<Set<string>> {
    if (this.majorVersion === 4) {
      return collectClassesFromTailwindV4(this.options)
    }

    const contexts = this.getContexts()
    return collectClassesFromContexts(contexts, this.options.filter)
  }

  private debugCacheRead(meta: CacheReadMeta) {
    if (meta.hit) {
      logger.debug(
        `[cache] hit fingerprint=${meta.fingerprint?.slice(0, 12) ?? 'n/a'} schema=${meta.schemaVersion ?? 'legacy'} ${meta.details.join('; ')}`,
      )
      return
    }

    logger.debug(
      `[cache] miss reason=${meta.reason} fingerprint=${meta.fingerprint?.slice(0, 12) ?? 'n/a'} schema=${meta.schemaVersion ?? 'legacy'} ${meta.details.join('; ')}`,
    )
  }

  private async mergeWithCache(set: Set<string>) {
    if (!this.options.cache.enabled) {
      return set
    }

    const { data: existing, meta } = await this.cacheStore.readWithMeta()
    this.debugCacheRead(meta)
    if (this.options.cache.strategy === 'merge') {
      for (const value of existing) {
        set.add(value)
      }
      const writeTarget = await this.cacheStore.write(set)
      if (writeTarget) {
        logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
      }
    }
    else {
      if (set.size > 0) {
        const writeTarget = await this.cacheStore.write(set)
        if (writeTarget) {
          logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
        }
      }
      else {
        return existing
      }
    }

    return set
  }

  private mergeWithCacheSync(set: Set<string>) {
    if (!this.options.cache.enabled) {
      return set
    }

    const { data: existing, meta } = this.cacheStore.readWithMetaSync()
    this.debugCacheRead(meta)
    if (this.options.cache.strategy === 'merge') {
      for (const value of existing) {
        set.add(value)
      }
      const writeTarget = this.cacheStore.writeSync(set)
      if (writeTarget) {
        logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
      }
    }
    else {
      if (set.size > 0) {
        const writeTarget = this.cacheStore.writeSync(set)
        if (writeTarget) {
          logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
        }
      }
      else {
        return existing
      }
    }

    return set
  }

  async getClassSet() {
    await this.runTailwindBuildIfNeeded()
    const set = await this.collectClassSet()
    return this.mergeWithCache(set)
  }

  getClassSetSync(): Set<string> | undefined {
    if (this.majorVersion === 4) {
      throw new Error('getClassSetSync is not supported for Tailwind CSS v4 projects. Use getClassSet instead.')
    }

    const contexts = this.getContexts()
    const set = collectClassesFromContexts(contexts, this.options.filter)
    const merged = this.mergeWithCacheSync(set)
    if (contexts.length === 0 && merged.size === 0) {
      return undefined
    }
    return merged
  }

  async extract(options?: { write?: boolean }): Promise<ExtractResult> {
    const shouldWrite = options?.write ?? this.options.output.enabled
    const classSet = await this.getClassSet()
    const classList = Array.from(classSet)

    const result: ExtractResult = {
      classList,
      classSet,
    }

    if (!shouldWrite || !this.options.output.file) {
      return result
    }

    const target = path.resolve(this.options.output.file)
    await fs.ensureDir(path.dirname(target))

    if (this.options.output.format === 'json') {
      const spaces = typeof this.options.output.pretty === 'number' ? this.options.output.pretty : undefined
      await fs.writeJSON(target, classList, { spaces })
    }
    else {
      await fs.writeFile(target, `${classList.join('\n')}\n`, 'utf8')
    }

    logger.success(`Tailwind CSS class list saved to ${target.replace(process.cwd(), '.')}`)

    return {
      ...result,
      filename: target,
    }
  }

  async clearCache(options?: CacheClearOptions): Promise<CacheClearResult> {
    const result = await this.cacheStore.clear(options)
    logger.debug(
      `[cache] clear scope=${result.scope} contexts=${result.contextsRemoved} entries=${result.entriesRemoved} files=${result.filesRemoved}`,
    )
    return result
  }

  // Backwards compatibility helper used by tests and API consumers.
  extractValidCandidates = extractCandidates

  async collectContentTokens(options?: { cwd?: string, sources?: SourceEntry[] }): Promise<TailwindTokenReport> {
    return extractProjectCandidatesWithPositions({
      cwd: options?.cwd ?? this.options.projectRoot,
      sources: options?.sources ?? this.options.tailwind.v4?.sources ?? [],
    })
  }

  async collectContentTokensByFile(options?: {
    cwd?: string
    sources?: SourceEntry[]
    key?: TailwindTokenFileKey
    stripAbsolutePaths?: boolean
  }): Promise<TailwindTokenByFileMap> {
    const collectContentOptions = {
      ...(options?.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options?.sources === undefined ? {} : { sources: options.sources }),
    }
    const report = await this.collectContentTokens(collectContentOptions)
    const groupOptions = {
      ...(options?.key === undefined ? {} : { key: options.key }),
      ...(options?.stripAbsolutePaths === undefined ? {} : { stripAbsolutePaths: options.stripAbsolutePaths }),
    }
    return groupTokensByFile(report, groupOptions)
  }
}

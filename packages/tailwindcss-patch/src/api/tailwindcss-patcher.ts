import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageInfo } from 'local-pkg'
import type { NormalizedTailwindcssPatchOptions } from '../config'
import type {
  CacheClearOptions,
  CacheClearResult,
  CacheContextMetadata,
  CacheReadMeta,
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
import { createCacheContextDescriptor } from '../cache/context'
import { CacheStore } from '../cache/store'
import { normalizeOptions } from '../config'
import {
  extractValidCandidates as extractCandidates,
  extractProjectCandidatesWithPositions,
  groupTokensByFile,
} from '../extraction/candidate-extractor'
import { collectClassesFromContexts, collectClassesFromTailwindV4 } from '../install/class-collector'
import { loadRuntimeContexts } from '../install/context-registry'
import { applyTailwindPatches } from '../install/patch-runner'
import { runTailwindBuild } from '../install/process-tailwindcss'
import { getPatchStatusReport } from '../install/status'
import logger from '../logger'

type TailwindMajorVersion = 2 | 3 | 4
type PatchResult = ReturnType<typeof applyTailwindPatches>

interface PatchMemo {
  result: PatchResult
  snapshot: string
}

function resolveInstalledMajorVersion(version?: string | null) {
  if (!version) {
    return undefined
  }

  const coerced = coerce(version)
  if (!coerced) {
    return undefined
  }

  const major = coerced.major as TailwindMajorVersion
  if (major === 2 || major === 3 || major === 4) {
    return major
  }

  if (major >= 4) {
    return 4
  }

  return undefined
}

function validateInstalledVersion(packageVersion: string | undefined, expectedMajor: TailwindMajorVersion, packageName: string) {
  const installedMajor = resolveInstalledMajorVersion(packageVersion)
  if (installedMajor === undefined) {
    return
  }

  if (installedMajor !== expectedMajor) {
    throw new Error(
      `Configured tailwindcss.version=${expectedMajor}, but resolved package "${packageName}" is version ${packageVersion}. Update the configuration or resolve the correct package.`,
    )
  }
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

export class TailwindcssPatcher {
  public readonly options: NormalizedTailwindcssPatchOptions
  public readonly packageInfo: PackageInfo
  public readonly majorVersion: TailwindMajorVersion

  private readonly cacheContext: {
    fingerprint: string
    metadata: CacheContextMetadata
  }

  private readonly cacheStore: CacheStore
  private patchMemo: PatchMemo | undefined
  private inFlightBuild: Promise<void> | undefined

  constructor(options: TailwindcssPatchOptions = {}) {
    this.options = normalizeOptions(options)
    const packageInfo = getPackageInfoSync(
      this.options.tailwind.packageName,
      this.options.tailwind.resolve,
    )

    if (!packageInfo) {
      throw new Error(`Unable to locate Tailwind CSS package "${this.options.tailwind.packageName}".`)
    }

    this.packageInfo = packageInfo as PackageInfo
    this.majorVersion = this.options.tailwind.versionHint
    validateInstalledVersion(this.packageInfo.version, this.majorVersion, this.options.tailwind.packageName)

    this.cacheContext = createCacheContextDescriptor(
      this.options,
      this.packageInfo,
      this.majorVersion,
    )
    this.cacheStore = new CacheStore(this.options.cache, this.cacheContext)
  }

  async patch() {
    const snapshot = this.createPatchSnapshot()
    if (this.patchMemo && this.patchMemo.snapshot === snapshot) {
      return this.patchMemo.result
    }

    const result = applyTailwindPatches({
      packageInfo: this.packageInfo,
      options: this.options,
      majorVersion: this.majorVersion,
    })
    this.patchMemo = {
      result,
      snapshot: this.createPatchSnapshot(),
    }
    return result
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
      if (this.inFlightBuild) {
        return this.inFlightBuild
      }

      const executionOptions = resolveTailwindExecutionOptions(this.options, this.majorVersion)
      const buildOptions = {
        cwd: executionOptions.cwd,
        majorVersion: this.majorVersion,
        ...(executionOptions.config === undefined ? {} : { config: executionOptions.config }),
        ...(executionOptions.postcssPlugin === undefined ? {} : { postcssPlugin: executionOptions.postcssPlugin }),
      }
      this.inFlightBuild = runTailwindBuild(buildOptions).then(() => undefined)
      try {
        await this.inFlightBuild
      }
      finally {
        this.inFlightBuild = undefined
      }
    }
  }

  private createPatchSnapshot() {
    const entries: string[] = []
    const pushSnapshot = (filePath: string) => {
      if (!fs.pathExistsSync(filePath)) {
        entries.push(`${filePath}:missing`)
        return
      }

      const stat = fs.statSync(filePath)
      entries.push(`${filePath}:${stat.size}:${Math.trunc(stat.mtimeMs)}`)
    }

    if (this.options.features.exposeContext.enabled && (this.majorVersion === 2 || this.majorVersion === 3)) {
      if (this.majorVersion === 2) {
        pushSnapshot(path.resolve(this.packageInfo.rootPath, 'lib/jit/processTailwindFeatures.js'))
        pushSnapshot(path.resolve(this.packageInfo.rootPath, 'lib/jit/index.js'))
      }
      else {
        pushSnapshot(path.resolve(this.packageInfo.rootPath, 'lib/processTailwindFeatures.js'))
        const pluginPath = ['lib/plugin.js', 'lib/index.js']
          .map(file => path.resolve(this.packageInfo.rootPath, file))
          .find(file => fs.pathExistsSync(file))
        if (pluginPath) {
          pushSnapshot(pluginPath)
        }
      }
    }

    if (this.options.features.extendLengthUnits?.enabled) {
      if (this.majorVersion === 3) {
        const target = this.options.features.extendLengthUnits.lengthUnitsFilePath ?? 'lib/util/dataTypes.js'
        pushSnapshot(path.resolve(this.packageInfo.rootPath, target))
      }
      else if (this.majorVersion === 4) {
        const distDir = path.resolve(this.packageInfo.rootPath, 'dist')
        if (fs.pathExistsSync(distDir)) {
          const chunkNames = fs.readdirSync(distDir)
            .filter(entry => entry.endsWith('.js') || entry.endsWith('.mjs'))
            .sort()
          for (const chunkName of chunkNames) {
            pushSnapshot(path.join(distDir, chunkName))
          }
        }
        else {
          entries.push(`${distDir}:missing`)
        }
      }
    }

    return entries.join('|')
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
      const writeTarget = this.areSetsEqual(existing, set)
        ? undefined
        : await this.cacheStore.write(set)
      if (writeTarget) {
        logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
      }
    }
    else {
      if (set.size > 0) {
        const writeTarget = this.areSetsEqual(existing, set)
          ? undefined
          : await this.cacheStore.write(set)
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
      const writeTarget = this.areSetsEqual(existing, set)
        ? undefined
        : this.cacheStore.writeSync(set)
      if (writeTarget) {
        logger.debug(`[cache] stored ${set.size} classes -> ${writeTarget}`)
      }
    }
    else {
      if (set.size > 0) {
        const writeTarget = this.areSetsEqual(existing, set)
          ? undefined
          : this.cacheStore.writeSync(set)
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

  private areSetsEqual(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) {
      return false
    }

    for (const value of a) {
      if (!b.has(value)) {
        return false
      }
    }

    return true
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

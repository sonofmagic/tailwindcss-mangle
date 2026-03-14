import type { PackageInfo } from 'local-pkg'
import type { NormalizedTailwindCssPatchOptions } from '../config'
import type { PatchStatusReport, TailwindcssRuntimeContext } from '../types'
import type { applyTailwindPatches } from '../install/patch-runner'
import { collectClassesFromContexts, collectClassesFromTailwindV4 } from '../install/class-collector'
import { loadRuntimeContexts } from '../install/context-registry'
import { applyTailwindPatches as runPatch } from '../install/patch-runner'
import { runTailwindBuild } from '../install/process-tailwindcss'
import { getPatchStatusReport } from '../install/status'

export type TailwindMajorVersion = 2 | 3 | 4
export type PatchResult = ReturnType<typeof applyTailwindPatches>

export interface TailwindCollector {
  patch(): Promise<PatchResult>
  getPatchStatus(): Promise<PatchStatusReport>
  collectClassSet(): Promise<Set<string>>
  getContexts(): TailwindcssRuntimeContext[]
  getPatchSnapshot(): string
  runTailwindBuildIfNeeded?(): Promise<void>
}

function resolveTailwindExecutionOptions(
  normalized: NormalizedTailwindCssPatchOptions,
  majorVersion: 2 | 3,
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

abstract class BaseCollector implements TailwindCollector {
  constructor(
    protected readonly packageInfo: PackageInfo,
    protected readonly options: NormalizedTailwindCssPatchOptions,
    protected readonly majorVersion: TailwindMajorVersion,
  ) {}

  async patch() {
    return runPatch({
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

  abstract collectClassSet(): Promise<Set<string>>
  abstract getPatchSnapshot(): string
}

export class RuntimeCollector extends BaseCollector {
  private inFlightBuild: Promise<void> | undefined

  constructor(
    packageInfo: PackageInfo,
    options: NormalizedTailwindCssPatchOptions,
    majorVersion: 2 | 3,
    private readonly snapshotFactory: () => string,
  ) {
    super(packageInfo, options, majorVersion)
  }

  async collectClassSet() {
    const contexts = this.getContexts()
    return collectClassesFromContexts(contexts, this.options.filter)
  }

  getPatchSnapshot() {
    return this.snapshotFactory()
  }

  async runTailwindBuildIfNeeded() {
    if (this.inFlightBuild) {
      return this.inFlightBuild
    }

    const executionOptions = resolveTailwindExecutionOptions(this.options, this.majorVersion as 2 | 3)
    const buildOptions = {
      cwd: executionOptions.cwd,
      majorVersion: this.majorVersion as 2 | 3,
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

export class TailwindV4Collector extends BaseCollector {
  constructor(
    packageInfo: PackageInfo,
    options: NormalizedTailwindCssPatchOptions,
    snapshotFactory: () => string,
  ) {
    super(packageInfo, options, 4)
    this.snapshotFactory = snapshotFactory
  }

  private readonly snapshotFactory: () => string

  async collectClassSet() {
    return collectClassesFromTailwindV4(this.options)
  }

  getPatchSnapshot() {
    return this.snapshotFactory()
  }
}

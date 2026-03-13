import { performance } from 'node:perf_hooks'
import { createRequire } from 'node:module'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { TailwindcssPatcher } from '../src/api/tailwindcss-patcher'

interface TimedResult<T> {
  durationMs: number
  value: T
}

interface ScenarioResult {
  label: string
  coldMs: number
  warmAvgMs: number
}

interface PreparedScenario {
  patcher: TailwindcssPatcher
  cleanup?: () => Promise<void>
}

interface PhaseResult {
  scenario: string
  totalMs: number
  buildMs: number
  collectMs: number
  cacheMs: number
}

const workspaceRoot = path.resolve(__dirname, '..')
const fixtureRoot = path.resolve(workspaceRoot, 'test/fixtures')
const require = createRequire(import.meta.url)

function resolveInstalledPackageRoot(packageName: string) {
  return path.dirname(require.resolve(`${packageName}/package.json`))
}

async function time<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now()
  const value = await fn()
  return {
    durationMs: performance.now() - start,
    value,
  }
}

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await fn(dir)
  }
  finally {
    await fs.remove(dir)
  }
}

async function backupPackageRoot(packageRoot: string, tempDir: string) {
  const backupRoot = path.join(tempDir, path.basename(packageRoot))
  await fs.copy(packageRoot, backupRoot)
  return async () => {
    await fs.remove(packageRoot)
    await fs.copy(backupRoot, packageRoot)
  }
}

async function setupV3Fixture(tempDir: string) {
  const projectRoot = path.join(tempDir, 'project')
  const packageRoot = resolveInstalledPackageRoot('tailwindcss-3')

  await fs.copy(path.join(fixtureRoot, 'apps/1.default'), projectRoot)

  return {
    projectRoot,
    packageRoot,
    cacheDir: path.join(tempDir, '.cache'),
    restorePackage: await backupPackageRoot(packageRoot, tempDir),
  }
}

async function setupV4Fixture(tempDir: string) {
  const projectRoot = path.join(tempDir, 'project')
  const packageRoot = resolveInstalledPackageRoot('tailwindcss-4')
  const linkedPackageRoot = path.join(tempDir, 'node_modules', 'tailwindcss')

  await fs.ensureDir(path.dirname(linkedPackageRoot))
  await fs.copy(path.join(fixtureRoot, 'v4'), projectRoot)
  await fs.ensureSymlink(packageRoot, linkedPackageRoot)

  return {
    projectRoot,
    packageRoot,
    cacheDir: path.join(tempDir, '.cache'),
    restorePackage: await backupPackageRoot(packageRoot, tempDir),
  }
}

function createV3Patcher(projectRoot: string, packageRoot: string, cacheDir: string) {
  return new TailwindcssPatcher({
    cwd: projectRoot,
    cache: {
      enabled: true,
      dir: cacheDir,
      file: 'class-cache.json',
    },
    output: {
      enabled: false,
    },
    tailwind: {
      packageName: 'tailwindcss-3',
      version: 3,
      postcssPlugin: 'tailwindcss-3',
      config: path.join(projectRoot, 'tailwind.config.js'),
      v3: {
        cwd: projectRoot,
        config: path.join(projectRoot, 'tailwind.config.js'),
        postcssPlugin: 'tailwindcss-3',
      },
    },
    features: {
      extendLengthUnits: {
        enabled: true,
        units: ['rpx'],
      },
    },
  })
}

function createV4Patcher(projectRoot: string, packageRoot: string, cacheDir: string) {
  return new TailwindcssPatcher({
    cwd: projectRoot,
    cache: {
      enabled: true,
      dir: cacheDir,
      file: 'class-cache.json',
    },
    output: {
      enabled: false,
    },
    tailwind: {
      packageName: 'tailwindcss-4',
      version: 4,
      v4: {
        base: projectRoot,
        cssEntries: [path.join(projectRoot, 'index.css')],
      },
    },
    features: {
      extendLengthUnits: {
        enabled: true,
        units: ['rpx'],
      },
    },
  })
}

async function benchmarkScenario(
  label: string,
  setup: (dir: string) => Promise<PreparedScenario>,
  action: (patcher: TailwindcssPatcher) => Promise<unknown>,
  warmRuns: number = 5,
): Promise<ScenarioResult> {
  const coldMs = await withTempDir('tw-patch-bench-', async (tempDir) => {
    const prepared = await setup(tempDir)
    try {
      return (await time(() => action(prepared.patcher))).durationMs
    }
    finally {
      await prepared.cleanup?.()
    }
  })

  const warmAvgMs = await withTempDir('tw-patch-bench-', async (tempDir) => {
    const prepared = await setup(tempDir)
    try {
      await action(prepared.patcher)

      let total = 0
      for (let i = 0; i < warmRuns; i++) {
        total += (await time(() => action(prepared.patcher))).durationMs
      }
      return total / warmRuns
    }
    finally {
      await prepared.cleanup?.()
    }
  })

  return {
    label,
    coldMs,
    warmAvgMs,
  }
}

async function benchmarkGetClassSetPhases(
  label: string,
  setup: (dir: string) => Promise<PreparedScenario>,
): Promise<PhaseResult> {
  return withTempDir('tw-patch-bench-', async (tempDir) => {
    const prepared = await setup(tempDir)
    const patcher = prepared.patcher as TailwindcssPatcher & {
      runTailwindBuildIfNeeded: () => Promise<void>
      collectClassSet: () => Promise<Set<string>>
      mergeWithCache: (set: Set<string>) => Promise<Set<string>>
    }

    const phase = {
      buildMs: 0,
      collectMs: 0,
      cacheMs: 0,
    }

    const originalBuild = patcher.runTailwindBuildIfNeeded.bind(patcher)
    patcher.runTailwindBuildIfNeeded = async () => {
      phase.buildMs += (await time(() => originalBuild())).durationMs
    }

    const originalCollect = patcher.collectClassSet.bind(patcher)
    patcher.collectClassSet = async () => {
      const result = await time(() => originalCollect())
      phase.collectMs += result.durationMs
      return result.value
    }

    const originalMerge = patcher.mergeWithCache.bind(patcher)
    patcher.mergeWithCache = async (set: Set<string>) => {
      const result = await time(() => originalMerge(set))
      phase.cacheMs += result.durationMs
      return result.value
    }

    try {
      const totalMs = (await time(() => patcher.getClassSet())).durationMs
      return {
        scenario: label,
        totalMs,
        buildMs: phase.buildMs,
        collectMs: phase.collectMs,
        cacheMs: phase.cacheMs,
      }
    }
    finally {
      await prepared.cleanup?.()
    }
  })
}

async function main() {
  const scenarios: ScenarioResult[] = []
  const phases: PhaseResult[] = []

  scenarios.push(await benchmarkScenario(
    'v3 patch only',
    async (tempDir) => {
      const fixture = await setupV3Fixture(tempDir)
      return {
        patcher: createV3Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    patcher => patcher.patch(),
  ))

  scenarios.push(await benchmarkScenario(
    'v3 getClassSet only',
    async (tempDir) => {
      const fixture = await setupV3Fixture(tempDir)
      const patcher = createV3Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir)
      await patcher.patch()
      return { patcher, cleanup: fixture.restorePackage }
    },
    patcher => patcher.getClassSet(),
  ))
  phases.push(await benchmarkGetClassSetPhases(
    'v3 getClassSet only',
    async (tempDir) => {
      const fixture = await setupV3Fixture(tempDir)
      const patcher = createV3Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir)
      await patcher.patch()
      return { patcher, cleanup: fixture.restorePackage }
    },
  ))

  scenarios.push(await benchmarkScenario(
    'v3 extract only',
    async (tempDir) => {
      const fixture = await setupV3Fixture(tempDir)
      const patcher = createV3Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir)
      await patcher.patch()
      return { patcher, cleanup: fixture.restorePackage }
    },
    patcher => patcher.extract({ write: false }),
  ))

  scenarios.push(await benchmarkScenario(
    'v3 cold first run',
    async (tempDir) => {
      const fixture = await setupV3Fixture(tempDir)
      return {
        patcher: createV3Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    async (patcher) => {
      await patcher.patch()
      return patcher.extract({ write: false })
    },
  ))

  scenarios.push(await benchmarkScenario(
    'v4 patch only',
    async (tempDir) => {
      const fixture = await setupV4Fixture(tempDir)
      return {
        patcher: createV4Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    patcher => patcher.patch(),
  ))

  scenarios.push(await benchmarkScenario(
    'v4 getClassSet only',
    async (tempDir) => {
      const fixture = await setupV4Fixture(tempDir)
      return {
        patcher: createV4Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    patcher => patcher.getClassSet(),
  ))
  phases.push(await benchmarkGetClassSetPhases(
    'v4 getClassSet only',
    async (tempDir) => {
      const fixture = await setupV4Fixture(tempDir)
      return {
        patcher: createV4Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
  ))

  scenarios.push(await benchmarkScenario(
    'v4 extract only',
    async (tempDir) => {
      const fixture = await setupV4Fixture(tempDir)
      return {
        patcher: createV4Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    patcher => patcher.extract({ write: false }),
  ))

  scenarios.push(await benchmarkScenario(
    'v4 cold first run',
    async (tempDir) => {
      const fixture = await setupV4Fixture(tempDir)
      return {
        patcher: createV4Patcher(fixture.projectRoot, fixture.packageRoot, fixture.cacheDir),
        cleanup: fixture.restorePackage,
      }
    },
    async (patcher) => {
      await patcher.patch()
      return patcher.extract({ write: false })
    },
  ))

  console.table(
    scenarios.map(item => ({
      scenario: item.label,
      coldMs: item.coldMs.toFixed(2),
      warmAvgMs: item.warmAvgMs.toFixed(2),
    })),
  )
  console.table(
    phases.map(item => ({
      scenario: item.scenario,
      totalMs: item.totalMs.toFixed(2),
      buildMs: item.buildMs.toFixed(2),
      collectMs: item.collectMs.toFixed(2),
      cacheMs: item.cacheMs.toFixed(2),
    })),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

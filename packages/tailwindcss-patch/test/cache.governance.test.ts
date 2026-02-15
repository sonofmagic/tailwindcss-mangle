import type { PackageInfo } from 'local-pkg'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TailwindcssPatcher } from '@/api/tailwindcss-patcher'
import { createCacheContextDescriptor } from '@/cache/context'
import { CacheStore } from '@/cache/store'
import { normalizeOptions } from '@/options/normalize'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-cache-govern-'))
})

afterEach(async () => {
  await fs.remove(tempDir)
  vi.restoreAllMocks()
})

function toPackageInfo(rootPath: string, version: string): PackageInfo {
  return {
    name: 'tailwindcss',
    rootPath,
    version,
  } as PackageInfo
}

async function createProject(name: string, configBody: string = 'module.exports = { content: [] }') {
  const projectRoot = path.join(tempDir, name)
  await fs.ensureDir(projectRoot)
  const configPath = path.join(projectRoot, 'tailwind.config.js')
  await fs.writeFile(configPath, configBody, 'utf8')
  return {
    projectRoot,
    configPath,
  }
}

function createStore(
  projectRoot: string,
  cacheDir: string,
  packageVersion: string,
  packageRoot: string,
): CacheStore {
  const normalized = normalizeOptions({
    cwd: projectRoot,
    cache: {
      enabled: true,
      dir: cacheDir,
      file: 'cache.json',
      strategy: 'overwrite',
    },
    output: {
      enabled: false,
    },
    tailwind: {
      version: 3,
      config: 'tailwind.config.js',
    },
  })

  const context = createCacheContextDescriptor(
    normalized,
    toPackageInfo(packageRoot, packageVersion),
    3,
  )

  return new CacheStore(normalized.cache, context)
}

describe('cache governance', () => {
  it('same project cache: first miss then hit', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const project = await createProject('project-a')

    const store = createStore(project.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)

    const first = await store.readWithMeta()
    expect(first.meta.hit).toBe(false)

    await store.write(new Set(['text-red-500']))

    const second = await store.readWithMeta()
    expect(second.meta.hit).toBe(true)
    expect(second.data.has('text-red-500')).toBe(true)
  })

  it('different projects with same content do not hit each other', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const storeA = createStore(projectA.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    const storeB = createStore(projectB.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)

    await storeA.write(new Set(['font-bold']))

    const resultB = await storeB.readWithMeta()
    expect(resultB.meta.hit).toBe(false)
    expect(resultB.data.size).toBe(0)
  })

  it('invalidates cache when tailwind config changes', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const project = await createProject('project-a')

    const storeV1 = createStore(project.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    await storeV1.write(new Set(['px-4']))

    await new Promise(resolve => setTimeout(resolve, 20))
    await fs.writeFile(project.configPath, 'module.exports = { content: ["./src/**/*"] }', 'utf8')

    const storeV2 = createStore(project.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    const result = await storeV2.readWithMeta()

    expect(result.meta.hit).toBe(false)
    expect(result.meta.reason).toBe('context-mismatch')
    expect(result.meta.details.some(detail => detail.includes('tailwind-config mtime changed'))).toBe(true)
  })

  it('invalidates cache when tailwind version or patcher version changes', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const project = await createProject('project-a')

    const storeV1 = createStore(project.projectRoot, sharedCacheDir, '3.4.18', pkgRoot)
    await storeV1.write(new Set(['underline']))

    const storeV2 = createStore(project.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    const versionMismatch = await storeV2.readWithMeta()
    expect(versionMismatch.meta.hit).toBe(false)
    expect(versionMismatch.meta.reason).toBe('context-mismatch')
    expect(versionMismatch.meta.details.some(detail => detail.includes('tailwind-package version changed'))).toBe(true)

    const cachePath = path.join(sharedCacheDir, 'cache.json')
    const cacheIndex = await fs.readJSON(cachePath)
    const firstFingerprint = Object.keys(cacheIndex.contexts)[0]
    if (!firstFingerprint) {
      throw new Error('expected cache context to exist')
    }
    cacheIndex.contexts[firstFingerprint].context.patcherVersion = '0.0.0'
    await fs.writeJSON(cachePath, cacheIndex)

    const patcherMismatch = await storeV2.readWithMeta()
    expect(patcherMismatch.meta.hit).toBe(false)
    expect(patcherMismatch.meta.reason).toBe('context-mismatch')
    expect(patcherMismatch.meta.details.some(detail => detail.includes('patcher version changed'))).toBe(true)
  })

  it('clearCache API clears current context only by default and supports all', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const patcherA = new TailwindcssPatcher({
      cwd: projectA.projectRoot,
      cache: {
        enabled: true,
        dir: sharedCacheDir,
        file: 'cache.json',
      },
      output: {
        enabled: false,
      },
    })

    const patcherB = new TailwindcssPatcher({
      cwd: projectB.projectRoot,
      cache: {
        enabled: true,
        dir: sharedCacheDir,
        file: 'cache.json',
      },
      output: {
        enabled: false,
      },
    })

    vi.spyOn(patcherA, 'getContexts').mockReturnValue([
      {
        classCache: new Map([['from-a', []]]),
      } as any,
    ])

    vi.spyOn(patcherB, 'getContexts').mockReturnValue([
      {
        classCache: new Map([['from-b', []]]),
      } as any,
    ])

    patcherA.getClassSetSync()
    patcherB.getClassSetSync()

    const currentResult = await patcherA.clearCache()
    expect(currentResult.scope).toBe('current')
    expect(currentResult.contextsRemoved).toBe(1)

    const bSet = patcherB.getClassSetSync()
    expect(bSet?.has('from-b')).toBe(true)

    const clearAll = await patcherB.clearCache({ scope: 'all' })
    expect(clearAll.scope).toBe('all')
    expect(clearAll.filesRemoved).toBe(1)

    const cachePath = path.join(sharedCacheDir, 'cache.json')
    expect(await fs.pathExists(cachePath)).toBe(false)
  })

  it('legacy schema is read safely and rebuilt without crashing', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const project = await createProject('project-a')
    const cachePath = path.join(sharedCacheDir, 'cache.json')

    await fs.ensureDir(sharedCacheDir)
    await fs.writeJSON(cachePath, ['legacy-a', 'legacy-b'])

    const store = createStore(project.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    const readLegacy = await store.readWithMeta()

    expect(readLegacy.meta.hit).toBe(false)
    expect(readLegacy.meta.reason).toBe('legacy-schema')

    await store.write(new Set(['rebuilt']))
    const rebuilt = await fs.readJSON(cachePath)
    expect(rebuilt.schemaVersion).toBe(2)
  })

  it('concurrent writes keep cache index readable', async () => {
    const sharedCacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)
    const projectA = await createProject('project-a')
    const projectB = await createProject('project-b')

    const storeA = createStore(projectA.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)
    const storeB = createStore(projectB.projectRoot, sharedCacheDir, '3.4.19', pkgRoot)

    await Promise.all(
      Array.from({ length: 20 }).map((_, index) => {
        const target = index % 2 === 0 ? storeA : storeB
        return target.write(new Set([`token-${index}`]))
      }),
    )

    const cachePath = path.join(sharedCacheDir, 'cache.json')
    const parsed = await fs.readJSON(cachePath)
    expect(parsed.schemaVersion).toBe(2)
    expect(typeof parsed.contexts).toBe('object')

    const contexts = Object.values(parsed.contexts as Record<string, { values?: string[] }>)
    expect(contexts.length).toBeGreaterThanOrEqual(2)
    for (const context of contexts) {
      expect(Array.isArray(context.values)).toBe(true)
    }
  })
})

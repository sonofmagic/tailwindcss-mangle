import type { PackageInfo } from 'local-pkg'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCacheContextDescriptor } from '@/cache/context'
import { CacheStore } from '@/cache/store'
import { normalizeOptions } from '@/options/normalize'

let tempDir: string

function toPackageInfo(rootPath: string, version: string): PackageInfo {
  return {
    name: 'tailwindcss',
    rootPath,
    version,
  } as PackageInfo
}

async function createStoreOptions(projectRoot: string, cacheDir: string, driver: 'file' | 'memory' = 'file') {
  await fs.ensureDir(projectRoot)
  await fs.writeFile(path.join(projectRoot, 'tailwind.config.js'), 'module.exports = { content: [] }', 'utf8')

  return normalizeOptions({
    cwd: projectRoot,
    cache: {
      enabled: true,
      dir: cacheDir,
      file: 'cache.json',
      strategy: 'overwrite',
      driver,
    },
    output: {
      enabled: false,
    },
    tailwind: {
      version: 3,
      config: 'tailwind.config.js',
    },
  })
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-store-context-'))
})

afterEach(async () => {
  await fs.remove(tempDir)
})

describe('CacheStore context-aware behavior', () => {
  it('supports sync hit path and exposes immutable last read metadata copy', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)

    const normalized = await createStoreOptions(projectRoot, cacheDir, 'file')
    const context = createCacheContextDescriptor(normalized, toPackageInfo(pkgRoot, '3.4.19'), 3)
    const store = new CacheStore(normalized.cache, context)

    store.writeSync(new Set(['sync-hit']))
    const read = store.readWithMetaSync()
    expect(read.meta.hit).toBe(true)
    expect(read.data.has('sync-hit')).toBe(true)

    const meta = store.getLastReadMeta()
    meta.details.push('mutated')
    const meta2 = store.getLastReadMeta()
    expect(meta2.details.includes('mutated')).toBe(false)
  })

  it('clearSync current-context keeps other contexts and readIndexSnapshot remains valid', async () => {
    const projectA = path.join(tempDir, 'project-a')
    const projectB = path.join(tempDir, 'project-b')
    const cacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)

    const normalizedA = await createStoreOptions(projectA, cacheDir, 'file')
    const normalizedB = await createStoreOptions(projectB, cacheDir, 'file')

    const storeA = new CacheStore(
      normalizedA.cache,
      createCacheContextDescriptor(normalizedA, toPackageInfo(pkgRoot, '3.4.19'), 3),
    )
    const storeB = new CacheStore(
      normalizedB.cache,
      createCacheContextDescriptor(normalizedB, toPackageInfo(pkgRoot, '3.4.19'), 3),
    )

    storeA.writeSync(new Set(['from-a']))
    storeB.writeSync(new Set(['from-b']))

    const clearA = storeA.clearSync()
    expect(clearA.contextsRemoved).toBe(1)

    const bRead = storeB.readWithMetaSync()
    expect(bRead.meta.hit).toBe(true)
    expect(bRead.data.has('from-b')).toBe(true)

    const snapshot = storeB.readIndexSnapshot()
    expect(snapshot?.schemaVersion).toBe(2)
    expect(Object.keys(snapshot?.contexts ?? {}).length).toBeGreaterThanOrEqual(1)
  })

  it('supports memory driver clear paths for current and all scopes', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)

    const normalized = await createStoreOptions(projectRoot, cacheDir, 'memory')
    const context = createCacheContextDescriptor(normalized, toPackageInfo(pkgRoot, '3.4.19'), 3)
    const store = new CacheStore(normalized.cache, context)

    store.writeSync(new Set(['one', 'two']))
    const current = store.clearSync({ scope: 'current' })
    expect(current.contextsRemoved).toBe(1)
    expect(current.entriesRemoved).toBe(2)

    store.writeSync(new Set(['three']))
    const all = store.clearSync({ scope: 'all' })
    expect(all.scope).toBe('all')
    expect(all.entriesRemoved).toBe(1)
  })

  it('returns context-mismatch details when nearest project context exists', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)

    const normalized = await createStoreOptions(projectRoot, cacheDir, 'file')
    const context = createCacheContextDescriptor(normalized, toPackageInfo(pkgRoot, '3.4.19'), 3)
    const store = new CacheStore(normalized.cache, context)

    await store.write(new Set(['before-change']))

    const cachePath = normalized.cache.path
    const payload = await fs.readJSON(cachePath)
    const fingerprint = Object.keys(payload.contexts)[0]
    if (!fingerprint) {
      throw new Error('expected context fingerprint')
    }

    payload.contexts[fingerprint].context.optionsHash = 'changed-hash'
    await fs.writeJSON(cachePath, payload)

    const result = await store.readWithMeta()
    expect(result.meta.hit).toBe(false)
    expect(result.meta.reason).toBe('context-mismatch')
    expect(result.meta.details.some(detail => detail.includes('patch options hash changed'))).toBe(true)
  })

  it('returns a deep-cloned index snapshot for memory driver', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')
    const pkgRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(pkgRoot)

    const normalized = await createStoreOptions(projectRoot, cacheDir, 'memory')
    const context = createCacheContextDescriptor(normalized, toPackageInfo(pkgRoot, '3.4.19'), 3)
    const store = new CacheStore(normalized.cache, context)

    store.writeSync(new Set(['snap-a']))
    const snapshot = store.readIndexSnapshot()
    expect(snapshot?.schemaVersion).toBe(2)

    const fingerprint = Object.keys(snapshot?.contexts ?? {})[0]
    if (!fingerprint || !snapshot) {
      throw new Error('expected memory snapshot fingerprint')
    }

    snapshot.contexts[fingerprint].values.push('mutated')
    const snapshot2 = store.readIndexSnapshot()
    expect(snapshot2?.contexts[fingerprint].values).toEqual(['snap-a'])
  })

  it('returns undefined snapshot for non-v2 file cache payloads', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')

    const normalized = await createStoreOptions(projectRoot, cacheDir, 'file')
    await fs.ensureDir(path.dirname(normalized.cache.path))
    await fs.writeJSON(normalized.cache.path, ['legacy-class'])

    const store = new CacheStore(normalized.cache)
    expect(store.readIndexSnapshot()).toBeUndefined()
  })

  it('supports memory driver reads without context descriptor', async () => {
    const projectRoot = path.join(tempDir, 'project-a')
    const cacheDir = path.join(tempDir, '.cache')
    const normalized = await createStoreOptions(projectRoot, cacheDir, 'memory')
    const store = new CacheStore(normalized.cache)

    expect((await store.readWithMeta()).meta.hit).toBe(false)
    await store.write(new Set(['plain-memory']))

    const result = await store.readWithMeta()
    expect(result.meta.hit).toBe(true)
    expect(result.meta.reason).toBe('hit')
    expect(result.data.has('plain-memory')).toBe(true)
  })
})

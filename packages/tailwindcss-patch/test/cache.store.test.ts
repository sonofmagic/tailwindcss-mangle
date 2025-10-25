import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CacheStore } from '@/cache/store'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-cache-'))
})

afterEach(async () => {
  await fs.remove(tempDir)
})

describe('CacheStore', () => {
  it('reads and writes cache data', async () => {
    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: path.join(tempDir, 'cache.json'),
      strategy: 'merge',
    })

    const initial = await store.read()
    expect(initial.size).toBe(0)

    const data = new Set(['a', 'b'])
    await store.write(data)
    const restored = await store.read()
    expect(restored.size).toBe(2)
    expect(restored.has('a')).toBe(true)
  })

  it('clears invalid cache files automatically', async () => {
    const cachePath = path.join(tempDir, 'cache.json')
    await fs.outputFile(cachePath, '{ not: valid json }', 'utf8')

    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const restored = await store.read()
    expect(restored.size).toBe(0)
    expect(await fs.pathExists(cachePath)).toBe(false)
  })
})

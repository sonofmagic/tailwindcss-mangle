import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheStore } from '@/cache/store'
import logger from '@/logger'

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

  it('reads and writes cache data synchronously', () => {
    const cachePath = path.join(tempDir, 'cache.json')
    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const initial = store.readSync()
    expect(initial.size).toBe(0)

    const data = new Set(['foo'])
    store.writeSync(data)

    const restored = store.readSync()
    expect(restored.size).toBe(1)
    expect(restored.has('foo')).toBe(true)
  })

  it('ignores ENOENT errors while reading cache files', async () => {
    const cachePath = path.join(tempDir, 'cache.json')
    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const warnSpy = vi.spyOn(logger, 'warn')
    const removeSpy = vi.spyOn(fs, 'remove')
    const pathExistsSpy = vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const enoentError = Object.assign(new Error('missing'), { code: 'ENOENT' as NodeJS.ErrnoException['code'] })
    const readSpy = vi.spyOn(fs, 'readJSON').mockRejectedValue(enoentError)

    const restored = await store.read()
    expect(restored.size).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
    removeSpy.mockRestore()
    pathExistsSpy.mockRestore()
    readSpy.mockRestore()
  })

  it('ignores ENOENT errors while reading cache files synchronously', () => {
    const cachePath = path.join(tempDir, 'cache.json')
    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const warnSpy = vi.spyOn(logger, 'warn')
    const removeSpy = vi.spyOn(fs, 'removeSync')
    const pathExistsSpy = vi.spyOn(fs, 'pathExistsSync').mockReturnValue(true)
    const enoentError = Object.assign(new Error('missing'), { code: 'ENOENT' as NodeJS.ErrnoException['code'] })
    const readSpy = vi.spyOn(fs, 'readJSONSync').mockImplementation(() => {
      throw enoentError
    })

    const restored = store.readSync()
    expect(restored.size).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(removeSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
    removeSpy.mockRestore()
    pathExistsSpy.mockRestore()
    readSpy.mockRestore()
  })
})

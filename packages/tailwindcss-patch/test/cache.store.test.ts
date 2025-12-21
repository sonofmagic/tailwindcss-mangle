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

  it('writes through a temporary file then renames atomically', async () => {
    const cachePath = path.join(tempDir, 'cache.json')
    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const writeJSONSpy = vi.spyOn(fs, 'writeJSON')
    const renameSpy = vi.spyOn(fs, 'rename')

    const data = new Set(['safe'])
    await store.write(data)

    expect(writeJSONSpy).toHaveBeenCalled()
    const tempPath = writeJSONSpy.mock.calls[0]?.[0] as string
    expect(tempPath).not.toBe(cachePath)
    expect(tempPath?.startsWith(`${cachePath}.`)).toBe(true)
    expect(renameSpy).toHaveBeenCalledWith(tempPath, cachePath)

    writeJSONSpy.mockRestore()
    renameSpy.mockRestore()
  })

  it('retries rename conflicts by replacing the destination file', async () => {
    const cachePath = path.join(tempDir, 'cache.json')
    await fs.writeJSON(cachePath, ['old'])

    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const originalRename = fs.rename
    const renameSpy = vi.spyOn(fs, 'rename')
    let attempt = 0
    renameSpy.mockImplementation(async (...args) => {
      if (attempt === 0) {
        attempt += 1
        const error = Object.assign(new Error('exists'), {
          code: 'EEXIST' as NodeJS.ErrnoException['code'],
        })
        throw error
      }

      return originalRename.apply(fs, args as Parameters<typeof fs.rename>)
    })

    const removeSpy = vi.spyOn(fs, 'remove')

    await store.write(new Set(['fresh']))

    expect(renameSpy).toHaveBeenCalledTimes(2)
    expect(removeSpy).toHaveBeenCalledTimes(1)

    const restored = await store.read()
    expect(restored.has('fresh')).toBe(true)

    renameSpy.mockRestore()
    removeSpy.mockRestore()
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
    const pathExistsSpy = vi.spyOn(fs, 'pathExists').mockImplementation(async () => true)
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

  it('skips cache writes when the destination cannot be removed (async)', async () => {
    const cachePath = path.join(tempDir, 'cache.json')
    await fs.writeJSON(cachePath, ['old'])

    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const writeJSONSpy = vi.spyOn(fs, 'writeJSON')
    const debugSpy = vi.spyOn(logger, 'debug')
    const renameSpy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(
      Object.assign(new Error('exists'), { code: 'EEXIST' as NodeJS.ErrnoException['code'] }),
    )
    const realRemove = fs.remove
    let removeAttempts = 0
    const removeSpy = vi.spyOn(fs, 'remove').mockImplementation(async (...args) => {
      removeAttempts += 1
      if (removeAttempts === 1) {
        const error = Object.assign(new Error('locked'), { code: 'EPERM' as NodeJS.ErrnoException['code'] })
        throw error
      }
      return realRemove.apply(fs, args as Parameters<typeof fs.remove>)
    })

    const result = await store.write(new Set(['fresh']))
    expect(result).toBeUndefined()
    expect(renameSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(2)
    expect(debugSpy).toHaveBeenCalled()

    const tempPath = writeJSONSpy.mock.calls[0]?.[0] as string
    expect(tempPath).toBeTruthy()
    expect(await fs.pathExists(tempPath)).toBe(false)

    writeJSONSpy.mockRestore()
    debugSpy.mockRestore()
    renameSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('skips cache writes when the destination cannot be removed (sync)', () => {
    const cachePath = path.join(tempDir, 'cache.json')
    fs.writeJSONSync(cachePath, ['old'])

    const store = new CacheStore({
      enabled: true,
      cwd: tempDir,
      dir: tempDir,
      file: 'cache.json',
      path: cachePath,
      strategy: 'merge',
    })

    const writeJSONSpy = vi.spyOn(fs, 'writeJSONSync')
    const debugSpy = vi.spyOn(logger, 'debug')
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      const error = Object.assign(new Error('exists'), { code: 'EEXIST' as NodeJS.ErrnoException['code'] })
      throw error
    })
    const realRemove = fs.removeSync
    let removeAttempts = 0
    const removeSpy = vi.spyOn(fs, 'removeSync').mockImplementation((...args) => {
      removeAttempts += 1
      if (removeAttempts === 1) {
        const error = Object.assign(new Error('locked'), { code: 'EPERM' as NodeJS.ErrnoException['code'] })
        throw error
      }
      return realRemove.apply(fs, args as Parameters<typeof fs.removeSync>)
    })

    const result = store.writeSync(new Set(['fresh']))
    expect(result).toBeUndefined()
    expect(renameSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(2)
    expect(debugSpy).toHaveBeenCalled()

    const tempPath = writeJSONSpy.mock.calls[0]?.[0] as string
    expect(tempPath).toBeTruthy()
    expect(fs.pathExistsSync(tempPath)).toBe(false)

    writeJSONSpy.mockRestore()
    debugSpy.mockRestore()
    renameSpy.mockRestore()
    removeSpy.mockRestore()
  })
})

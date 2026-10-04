import type { NormalizedCacheOptions } from '../options/types'
import type { CacheClearOptions, CacheClearResult, CacheContextDescriptor, CacheIndexFileV2, CacheReadMeta, CacheReadResult } from './types'
import process from 'node:process'
import { NativeCacheState } from '@tailwindcss-mangle/native'
import fs from 'fs-extra'
import logger from '../logger'

interface ParsedCacheFileV2 {
  kind: 'v2'
  data: CacheIndexFileV2
}

interface ParsedCacheFileLegacy {
  kind: 'legacy'
  data: string[]
}

interface ParsedCacheFileEmpty {
  kind: 'empty'
}

interface ParsedCacheFileInvalid {
  kind: 'invalid'
}

type ParsedCacheFile = ParsedCacheFileV2 | ParsedCacheFileLegacy | ParsedCacheFileEmpty | ParsedCacheFileInvalid

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function isAccessDenied(error: unknown): error is NodeJS.ErrnoException {
  return isErrnoException(error)
    && Boolean(error.code && ['EPERM', 'EBUSY', 'EACCES'].includes(error.code))
}

interface WritePlan {
  kind: 'skip' | 'memory' | 'file'
  payload?: CacheIndexFileV2 | string[]
}

interface ClearPlan {
  action: 'none' | 'remove' | 'write'
  result: CacheClearResult
  payload?: CacheIndexFileV2
}

export class CacheStore {
  private readonly driver: NormalizedCacheOptions['driver']
  private readonly lockPath: string
  private readonly state: NativeCacheState

  constructor(
    private readonly options: NormalizedCacheOptions,
    private readonly context?: CacheContextDescriptor,
  ) {
    this.driver = options.driver ?? 'file'
    this.lockPath = `${this.options.path}.lock`
    this.state = new NativeCacheState(options.enabled, this.driver, context === undefined ? undefined : JSON.stringify(context))
  }

  private normalizeIndexFile(payload: unknown): ParsedCacheFile {
    return JSON.parse(this.state.normalizeIndex(JSON.stringify(payload))) as ParsedCacheFile
  }

  private async ensureDir() {
    await fs.ensureDir(this.options.dir)
  }

  private ensureDirSync() {
    fs.ensureDirSync(this.options.dir)
  }

  private createTempPath() {
    const uniqueSuffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    return `${this.options.path}.${uniqueSuffix}.tmp`
  }

  private async replaceCacheFile(tempPath: string): Promise<boolean> {
    try {
      await fs.rename(tempPath, this.options.path)
      return true
    }
    catch (error) {
      if (isErrnoException(error) && (error.code === 'EEXIST' || error.code === 'EPERM')) {
        try {
          await fs.remove(this.options.path)
        }
        catch (removeError) {
          if (isAccessDenied(removeError)) {
            logger.debug('Tailwind class cache locked or read-only, skipping update.', removeError)
            return false
          }

          if (!isErrnoException(removeError) || removeError.code !== 'ENOENT') {
            throw removeError
          }
        }

        await fs.rename(tempPath, this.options.path)
        return true
      }

      throw error
    }
  }

  private replaceCacheFileSync(tempPath: string): boolean {
    try {
      fs.renameSync(tempPath, this.options.path)
      return true
    }
    catch (error) {
      if (isErrnoException(error) && (error.code === 'EEXIST' || error.code === 'EPERM')) {
        try {
          fs.removeSync(this.options.path)
        }
        catch (removeError) {
          if (isAccessDenied(removeError)) {
            logger.debug('Tailwind class cache locked or read-only, skipping update.', removeError)
            return false
          }

          if (!isErrnoException(removeError) || removeError.code !== 'ENOENT') {
            throw removeError
          }
        }

        fs.renameSync(tempPath, this.options.path)
        return true
      }

      throw error
    }
  }

  private async cleanupTempFile(tempPath: string) {
    try {
      await fs.remove(tempPath)
    }
    catch {}
  }

  private cleanupTempFileSync(tempPath: string) {
    try {
      fs.removeSync(tempPath)
    }
    catch {}
  }

  private async delay(ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms))
  }

  private async acquireLock(): Promise<boolean> {
    await fs.ensureDir(this.options.dir)
    const maxAttempts = 40
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await fs.writeFile(this.lockPath, `${process.pid}\n${Date.now()}`, { flag: 'wx' })
        return true
      }
      catch (error) {
        if (!isErrnoException(error) || error.code !== 'EEXIST') {
          logger.debug('Unable to acquire cache lock.', error)
          return false
        }

        try {
          const stat = await fs.stat(this.lockPath)
          if (Date.now() - stat.mtimeMs > 30_000) {
            await fs.remove(this.lockPath)
            continue
          }
        }
        catch {}

        await this.delay(25)
      }
    }

    logger.debug('Timed out while waiting for cache lock; skipping cache mutation.')
    return false
  }

  private releaseLockSyncOrAsync(sync: true): void
  private releaseLockSyncOrAsync(sync: false): Promise<void>
  private releaseLockSyncOrAsync(sync: boolean): void | Promise<void> {
    if (sync) {
      try {
        fs.removeSync(this.lockPath)
      }
      catch {}
      return
    }

    return fs.remove(this.lockPath).catch(() => undefined)
  }

  private acquireLockSync(): boolean {
    fs.ensureDirSync(this.options.dir)
    const maxAttempts = 40
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        fs.writeFileSync(this.lockPath, `${process.pid}\n${Date.now()}`, { flag: 'wx' })
        return true
      }
      catch (error) {
        if (!isErrnoException(error) || error.code !== 'EEXIST') {
          logger.debug('Unable to acquire cache lock.', error)
          return false
        }

        try {
          const stat = fs.statSync(this.lockPath)
          if (Date.now() - stat.mtimeMs > 30_000) {
            fs.removeSync(this.lockPath)
            continue
          }
        }
        catch {}

        const start = Date.now()
        while (Date.now() - start < 25) {
          // busy-wait sleep for sync lock retries
        }
      }
    }

    logger.debug('Timed out while waiting for cache lock; skipping cache mutation.')
    return false
  }

  private async withFileLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
    const locked = await this.acquireLock()
    if (!locked) {
      return undefined
    }

    try {
      return await fn()
    }
    finally {
      await this.releaseLockSyncOrAsync(false)
    }
  }

  private withFileLockSync<T>(fn: () => T): T | undefined {
    const locked = this.acquireLockSync()
    if (!locked) {
      return undefined
    }

    try {
      return fn()
    }
    finally {
      this.releaseLockSyncOrAsync(true)
    }
  }

  private async readParsedCacheFile(cleanupInvalid: boolean): Promise<ParsedCacheFile> {
    try {
      if (!(await fs.pathExists(this.options.path))) {
        return { kind: 'empty' }
      }

      const payload = await fs.readJSON(this.options.path)
      const normalized = this.normalizeIndexFile(payload)
      if (normalized.kind !== 'invalid') {
        return normalized
      }

      if (cleanupInvalid) {
        logger.warn('Unable to read Tailwind class cache index, removing invalid file.')
        await fs.remove(this.options.path)
      }
      return { kind: 'invalid' }
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return { kind: 'empty' }
      }

      logger.warn('Unable to read Tailwind class cache index, removing invalid file.', error)
      if (cleanupInvalid) {
        try {
          await fs.remove(this.options.path)
        }
        catch (cleanupError) {
          logger.error('Failed to clean up invalid cache file', cleanupError)
        }
      }

      return { kind: 'invalid' }
    }
  }

  private readParsedCacheFileSync(cleanupInvalid: boolean): ParsedCacheFile {
    try {
      if (!fs.pathExistsSync(this.options.path)) {
        return { kind: 'empty' }
      }

      const payload = fs.readJSONSync(this.options.path)
      const normalized = this.normalizeIndexFile(payload)
      if (normalized.kind !== 'invalid') {
        return normalized
      }

      if (cleanupInvalid) {
        logger.warn('Unable to read Tailwind class cache index, removing invalid file.')
        fs.removeSync(this.options.path)
      }
      return { kind: 'invalid' }
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return { kind: 'empty' }
      }

      logger.warn('Unable to read Tailwind class cache index, removing invalid file.', error)
      if (cleanupInvalid) {
        try {
          fs.removeSync(this.options.path)
        }
        catch (cleanupError) {
          logger.error('Failed to clean up invalid cache file', cleanupError)
        }
      }

      return { kind: 'invalid' }
    }
  }

  private async writeIndexFile(index: CacheIndexFileV2 | string[]): Promise<string | undefined> {
    const tempPath = this.createTempPath()

    try {
      await this.ensureDir()
      await fs.writeJSON(tempPath, index)
      const replaced = await this.replaceCacheFile(tempPath)
      if (replaced) {
        return this.options.path
      }

      await this.cleanupTempFile(tempPath)
      return undefined
    }
    catch (error) {
      await this.cleanupTempFile(tempPath)
      logger.error('Unable to persist Tailwind class cache', error)
      return undefined
    }
  }

  private writeIndexFileSync(index: CacheIndexFileV2 | string[]): string | undefined {
    const tempPath = this.createTempPath()

    try {
      this.ensureDirSync()
      fs.writeJSONSync(tempPath, index)
      const replaced = this.replaceCacheFileSync(tempPath)
      if (replaced) {
        return this.options.path
      }

      this.cleanupTempFileSync(tempPath)
      return undefined
    }
    catch (error) {
      this.cleanupTempFileSync(tempPath)
      logger.error('Unable to persist Tailwind class cache', error)
      return undefined
    }
  }

  private refreshContext() {
    this.state.configure(this.options.enabled, this.context === undefined ? undefined : JSON.stringify(this.context))
  }

  private prepareWrite(data: Set<string>, parsed?: ParsedCacheFile): WritePlan {
    this.refreshContext()
    return JSON.parse(this.state.prepareWrite([...data], parsed === undefined ? undefined : JSON.stringify(parsed), new Date().toISOString())) as WritePlan
  }

  private async applyWrite(plan: WritePlan): Promise<string | undefined> {
    if (plan.kind === 'memory') {
      return 'memory'
    }
    return plan.kind === 'file' && plan.payload ? this.writeIndexFile(plan.payload) : undefined
  }

  private applyWriteSync(plan: WritePlan): string | undefined {
    if (plan.kind === 'memory') {
      return 'memory'
    }
    return plan.kind === 'file' && plan.payload ? this.writeIndexFileSync(plan.payload) : undefined
  }

  async write(data: Set<string>): Promise<string | undefined> {
    if (this.options.enabled && this.driver === 'file' && this.context) {
      return this.withFileLock(async () => this.applyWrite(this.prepareWrite(data, await this.readParsedCacheFile(false))))
    }
    return this.applyWrite(this.prepareWrite(data))
  }

  writeSync(data: Set<string>): string | undefined {
    if (this.options.enabled && this.driver === 'file' && this.context) {
      return this.withFileLockSync(() => this.applyWriteSync(this.prepareWrite(data, this.readParsedCacheFileSync(false))))
    }
    return this.applyWriteSync(this.prepareWrite(data))
  }

  private resolveRead(parsed?: ParsedCacheFile): CacheReadResult {
    this.refreshContext()
    const result = JSON.parse(this.state.read(parsed === undefined ? undefined : JSON.stringify(parsed))) as { data: string[], meta: CacheReadMeta }
    return { data: new Set(result.data), meta: result.meta }
  }

  async readWithMeta(): Promise<CacheReadResult> {
    return this.resolveRead(this.options.enabled && this.driver === 'file' ? await this.readParsedCacheFile(true) : undefined)
  }

  readWithMetaSync(): CacheReadResult {
    return this.resolveRead(this.options.enabled && this.driver === 'file' ? this.readParsedCacheFileSync(true) : undefined)
  }

  async read(): Promise<Set<string>> {
    const result = await this.readWithMeta()
    this.state.rememberReadMeta(JSON.stringify(result.meta))
    return result.data
  }

  readSync(): Set<string> {
    const result = this.readWithMetaSync()
    this.state.rememberReadMeta(JSON.stringify(result.meta))
    return result.data
  }

  getLastReadMeta(): CacheReadMeta {
    return JSON.parse(this.state.getLastReadMeta()) as CacheReadMeta
  }

  private prepareClear(scope: 'current' | 'all', parsed?: ParsedCacheFile): ClearPlan {
    this.refreshContext()
    return JSON.parse(this.state.prepareClear(scope, parsed === undefined ? undefined : JSON.stringify(parsed), new Date().toISOString())) as ClearPlan
  }

  private async applyClear(plan: ClearPlan): Promise<CacheClearResult> {
    if (plan.action === 'remove') {
      await fs.remove(this.options.path)
    }
    else if (plan.action === 'write' && plan.payload) {
      await this.writeIndexFile(plan.payload)
    }
    return plan.result
  }

  private applyClearSync(plan: ClearPlan): CacheClearResult {
    if (plan.action === 'remove') {
      fs.removeSync(this.options.path)
    }
    else if (plan.action === 'write' && plan.payload) {
      this.writeIndexFileSync(plan.payload)
    }
    return plan.result
  }

  async clear(options?: CacheClearOptions): Promise<CacheClearResult> {
    const scope = options?.scope ?? 'current'
    if (this.options.enabled && this.driver === 'file') {
      return await this.withFileLock(async () => this.applyClear(this.prepareClear(scope, await this.readParsedCacheFile(false))))
        ?? { scope, filesRemoved: 0, entriesRemoved: 0, contextsRemoved: 0 }
    }
    return this.applyClear(this.prepareClear(scope))
  }

  clearSync(options?: CacheClearOptions): CacheClearResult {
    const scope = options?.scope ?? 'current'
    if (this.options.enabled && this.driver === 'file') {
      return this.withFileLockSync(() => this.applyClearSync(this.prepareClear(scope, this.readParsedCacheFileSync(false))))
        ?? { scope, filesRemoved: 0, entriesRemoved: 0, contextsRemoved: 0 }
    }
    return this.applyClearSync(this.prepareClear(scope))
  }

  readIndexSnapshot(): CacheIndexFileV2 | undefined {
    const parsed = this.driver === 'memory' ? undefined : this.readParsedCacheFileSync(false)
    const snapshot = this.state.snapshot(parsed === undefined ? undefined : JSON.stringify(parsed))
    return snapshot == null ? undefined : JSON.parse(snapshot) as CacheIndexFileV2
  }
}

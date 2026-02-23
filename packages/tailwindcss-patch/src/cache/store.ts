import type { NormalizedCacheOptions } from '../options/types'
import type {
  CacheClearOptions,
  CacheClearResult,
  CacheContextDescriptor,
  CacheIndexEntry,
  CacheIndexFileV2,
  CacheReadMeta,
  CacheReadResult,
} from './types'
import process from 'node:process'
import fs from 'fs-extra'
import logger from '../logger'
import { explainContextMismatch } from './context'
import { CACHE_SCHEMA_VERSION } from './types'

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

function toReadMeta(meta: CacheReadMeta): CacheReadMeta {
  return {
    ...meta,
    details: [...meta.details],
  }
}

function cloneEntry(entry: CacheIndexEntry): CacheIndexEntry {
  return {
    context: {
      ...entry.context,
    },
    values: [...entry.values],
    updatedAt: entry.updatedAt,
  }
}

export class CacheStore {
  private readonly driver: NormalizedCacheOptions['driver']
  private readonly lockPath: string
  private memoryCache: Set<string> | null = null
  private memoryIndex: CacheIndexFileV2 | null = null
  private lastReadMeta: CacheReadMeta = {
    hit: false,
    reason: 'context-not-found',
    details: [],
  }

  constructor(
    private readonly options: NormalizedCacheOptions,
    private readonly context?: CacheContextDescriptor,
  ) {
    this.driver = options.driver ?? 'file'
    this.lockPath = `${this.options.path}.lock`
  }

  private isContextAware() {
    return this.context !== undefined
  }

  private createEmptyIndex(): CacheIndexFileV2 {
    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      contexts: {},
    }
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

  private normalizeContextEntry(value: unknown): CacheIndexEntry | undefined {
    const record = asObject(value)
    if (!record) {
      return undefined
    }

    const values = toStringArray(record.values)
    if (values.length === 0) {
      return undefined
    }

    const contextRecord = asObject(record.context)
    if (!contextRecord) {
      return undefined
    }

    const {
      fingerprintVersion,
      projectRootRealpath,
      processCwdRealpath,
      cacheCwdRealpath,
      tailwindConfigPath,
      tailwindConfigMtimeMs,
      tailwindPackageRootRealpath,
      tailwindPackageVersion,
      patcherVersion,
      majorVersion,
      optionsHash,
    } = contextRecord

    if (
      fingerprintVersion !== 1
      || typeof projectRootRealpath !== 'string'
      || typeof processCwdRealpath !== 'string'
      || typeof cacheCwdRealpath !== 'string'
      || typeof tailwindPackageRootRealpath !== 'string'
      || typeof tailwindPackageVersion !== 'string'
      || typeof patcherVersion !== 'string'
      || (majorVersion !== 2 && majorVersion !== 3 && majorVersion !== 4)
      || typeof optionsHash !== 'string'
    ) {
      return undefined
    }

    const normalized: CacheIndexEntry = {
      context: {
        fingerprintVersion,
        projectRootRealpath,
        processCwdRealpath,
        cacheCwdRealpath,
        ...(typeof tailwindConfigPath === 'string' ? { tailwindConfigPath } : {}),
        ...(typeof tailwindConfigMtimeMs === 'number' ? { tailwindConfigMtimeMs } : {}),
        tailwindPackageRootRealpath,
        tailwindPackageVersion,
        patcherVersion,
        majorVersion,
        optionsHash,
      },
      values,
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
    }

    return normalized
  }

  private normalizeIndexFile(payload: unknown): ParsedCacheFile {
    if (Array.isArray(payload)) {
      return {
        kind: 'legacy',
        data: toStringArray(payload),
      }
    }

    const record = asObject(payload)
    if (!record) {
      return { kind: 'invalid' }
    }

    if (record.schemaVersion !== CACHE_SCHEMA_VERSION) {
      return { kind: 'invalid' }
    }

    const contextsRecord = asObject(record.contexts)
    if (!contextsRecord) {
      return { kind: 'invalid' }
    }

    const contexts: CacheIndexFileV2['contexts'] = {}

    for (const [fingerprint, value] of Object.entries(contextsRecord)) {
      if (typeof fingerprint !== 'string' || !fingerprint) {
        continue
      }
      const entry = this.normalizeContextEntry(value)
      if (!entry) {
        continue
      }
      contexts[fingerprint] = entry
    }

    return {
      kind: 'v2',
      data: {
        schemaVersion: CACHE_SCHEMA_VERSION,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
        contexts,
      },
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

  private findProjectMatch(index: CacheIndexFileV2) {
    if (!this.context) {
      return undefined
    }

    const current = this.context.metadata.projectRootRealpath
    return Object.entries(index.contexts).find(([, entry]) => entry.context.projectRootRealpath === current)
  }

  private async writeIndexFile(index: CacheIndexFileV2): Promise<string | undefined> {
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

  private writeIndexFileSync(index: CacheIndexFileV2): string | undefined {
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

  async write(data: Set<string>): Promise<string | undefined> {
    if (!this.options.enabled) {
      return undefined
    }

    if (this.driver === 'noop') {
      return undefined
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware()) {
        this.memoryCache = new Set(data)
        return 'memory'
      }

      const index = this.memoryIndex ?? this.createEmptyIndex()
      if (!this.context) {
        return 'memory'
      }
      index.contexts[this.context.fingerprint] = {
        context: {
          ...this.context.metadata,
        },
        values: Array.from(data),
        updatedAt: new Date().toISOString(),
      }
      index.updatedAt = new Date().toISOString()
      this.memoryIndex = index
      return 'memory'
    }

    if (!this.isContextAware()) {
      const tempPath = this.createTempPath()
      try {
        await this.ensureDir()
        await fs.writeJSON(tempPath, Array.from(data))
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

    const result = await this.withFileLock(async () => {
      const parsed = await this.readParsedCacheFile(false)
      const index = parsed.kind === 'v2' ? parsed.data : this.createEmptyIndex()

      if (this.context) {
        index.contexts[this.context.fingerprint] = {
          context: {
            ...this.context.metadata,
          },
          values: Array.from(data),
          updatedAt: new Date().toISOString(),
        }
      }

      index.updatedAt = new Date().toISOString()
      return this.writeIndexFile(index)
    })

    return result
  }

  writeSync(data: Set<string>): string | undefined {
    if (!this.options.enabled) {
      return undefined
    }

    if (this.driver === 'noop') {
      return undefined
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware()) {
        this.memoryCache = new Set(data)
        return 'memory'
      }

      const index = this.memoryIndex ?? this.createEmptyIndex()
      if (!this.context) {
        return 'memory'
      }
      index.contexts[this.context.fingerprint] = {
        context: {
          ...this.context.metadata,
        },
        values: Array.from(data),
        updatedAt: new Date().toISOString(),
      }
      index.updatedAt = new Date().toISOString()
      this.memoryIndex = index
      return 'memory'
    }

    if (!this.isContextAware()) {
      const tempPath = this.createTempPath()
      try {
        this.ensureDirSync()
        fs.writeJSONSync(tempPath, Array.from(data))
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

    const result = this.withFileLockSync(() => {
      const parsed = this.readParsedCacheFileSync(false)
      const index = parsed.kind === 'v2' ? parsed.data : this.createEmptyIndex()

      if (this.context) {
        index.contexts[this.context.fingerprint] = {
          context: {
            ...this.context.metadata,
          },
          values: Array.from(data),
          updatedAt: new Date().toISOString(),
        }
      }

      index.updatedAt = new Date().toISOString()
      return this.writeIndexFileSync(index)
    })

    return result
  }

  async readWithMeta(): Promise<CacheReadResult> {
    if (!this.options.enabled) {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'cache-disabled',
          details: ['cache disabled'],
        },
      }
    }

    if (this.driver === 'noop') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'noop-driver',
          details: ['cache driver is noop'],
        },
      }
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware()) {
        const cache = new Set(this.memoryCache ?? [])
        return {
          data: cache,
          meta: {
            hit: cache.size > 0,
            reason: cache.size > 0 ? 'hit' : 'context-not-found',
            details: cache.size > 0 ? ['memory cache hit'] : ['memory cache miss'],
          },
        }
      }

      const index = this.memoryIndex
      if (!index || !this.context) {
        return {
          data: new Set(),
          meta: {
            hit: false,
            reason: 'context-not-found',
            ...(this.context?.fingerprint === undefined ? {} : { fingerprint: this.context.fingerprint }),
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: ['no in-memory cache index for current context'],
          },
        }
      }

      const entry = index.contexts[this.context.fingerprint]
      if (entry) {
        return {
          data: new Set(entry.values),
          meta: {
            hit: true,
            reason: 'hit',
            fingerprint: this.context.fingerprint,
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: ['memory cache hit'],
          },
        }
      }

      const projectMatch = this.findProjectMatch(index)
      if (projectMatch && this.context) {
        const [, matchedEntry] = projectMatch
        return {
          data: new Set(),
          meta: {
            hit: false,
            reason: 'context-mismatch',
            fingerprint: this.context.fingerprint,
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: explainContextMismatch(this.context.metadata, matchedEntry.context),
          },
        }
      }

      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-not-found',
          fingerprint: this.context.fingerprint,
          schemaVersion: CACHE_SCHEMA_VERSION,
          details: ['context fingerprint not found in memory cache index'],
        },
      }
    }

    const parsed = await this.readParsedCacheFile(true)

    if (parsed.kind === 'empty') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'file-missing',
          details: ['cache file not found'],
        },
      }
    }

    if (parsed.kind === 'invalid') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'invalid-schema',
          details: ['cache schema invalid and has been reset'],
        },
      }
    }

    if (!this.isContextAware()) {
      if (parsed.kind === 'legacy') {
        return {
          data: new Set(parsed.data),
          meta: {
            hit: parsed.data.length > 0,
            reason: parsed.data.length > 0 ? 'hit' : 'context-not-found',
            details: ['legacy cache format'],
          },
        }
      }

      const union = Object.values(parsed.data.contexts).flatMap(entry => entry.values)
      return {
        data: new Set(union),
        meta: {
          hit: union.length > 0,
          reason: union.length > 0 ? 'hit' : 'context-not-found',
          schemaVersion: parsed.data.schemaVersion,
          details: ['context-less read merged all cache entries'],
        },
      }
    }

    if (parsed.kind === 'legacy') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'legacy-schema',
          ...(this.context?.fingerprint === undefined ? {} : { fingerprint: this.context.fingerprint }),
          details: ['legacy cache schema detected; rebuilding cache with context fingerprint'],
        },
      }
    }

    if (!this.context) {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-not-found',
          details: ['cache context missing'],
        },
      }
    }

    const entry = parsed.data.contexts[this.context.fingerprint]
    if (entry) {
      const mismatchReasons = explainContextMismatch(this.context.metadata, entry.context)
      if (mismatchReasons.length === 0) {
        return {
          data: new Set(entry.values),
          meta: {
            hit: true,
            reason: 'hit',
            fingerprint: this.context.fingerprint,
            schemaVersion: parsed.data.schemaVersion,
            details: [`context fingerprint ${this.context.fingerprint.slice(0, 12)} matched`],
          },
        }
      }

      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-mismatch',
          fingerprint: this.context.fingerprint,
          schemaVersion: parsed.data.schemaVersion,
          details: mismatchReasons,
        },
      }
    }

    const projectMatch = this.findProjectMatch(parsed.data)
    if (projectMatch) {
      const [matchedFingerprint, matchedEntry] = projectMatch
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-mismatch',
          fingerprint: this.context.fingerprint,
          schemaVersion: parsed.data.schemaVersion,
          details: [
            `nearest context fingerprint: ${matchedFingerprint.slice(0, 12)}`,
            ...explainContextMismatch(this.context.metadata, matchedEntry.context),
          ],
        },
      }
    }

    return {
      data: new Set(),
      meta: {
        hit: false,
        reason: 'context-not-found',
        fingerprint: this.context.fingerprint,
        schemaVersion: parsed.data.schemaVersion,
        details: ['context fingerprint not found in cache index'],
      },
    }
  }

  readWithMetaSync(): CacheReadResult {
    if (!this.options.enabled) {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'cache-disabled',
          details: ['cache disabled'],
        },
      }
    }

    if (this.driver === 'noop') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'noop-driver',
          details: ['cache driver is noop'],
        },
      }
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware()) {
        const cache = new Set(this.memoryCache ?? [])
        return {
          data: cache,
          meta: {
            hit: cache.size > 0,
            reason: cache.size > 0 ? 'hit' : 'context-not-found',
            details: cache.size > 0 ? ['memory cache hit'] : ['memory cache miss'],
          },
        }
      }

      const index = this.memoryIndex
      if (!index || !this.context) {
        return {
          data: new Set(),
          meta: {
            hit: false,
            reason: 'context-not-found',
            ...(this.context?.fingerprint === undefined ? {} : { fingerprint: this.context.fingerprint }),
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: ['no in-memory cache index for current context'],
          },
        }
      }

      const entry = index.contexts[this.context.fingerprint]
      if (entry) {
        return {
          data: new Set(entry.values),
          meta: {
            hit: true,
            reason: 'hit',
            fingerprint: this.context.fingerprint,
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: ['memory cache hit'],
          },
        }
      }

      const projectMatch = this.findProjectMatch(index)
      if (projectMatch && this.context) {
        const [, matchedEntry] = projectMatch
        return {
          data: new Set(),
          meta: {
            hit: false,
            reason: 'context-mismatch',
            fingerprint: this.context.fingerprint,
            schemaVersion: CACHE_SCHEMA_VERSION,
            details: explainContextMismatch(this.context.metadata, matchedEntry.context),
          },
        }
      }

      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-not-found',
          fingerprint: this.context.fingerprint,
          schemaVersion: CACHE_SCHEMA_VERSION,
          details: ['context fingerprint not found in memory cache index'],
        },
      }
    }

    const parsed = this.readParsedCacheFileSync(true)

    if (parsed.kind === 'empty') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'file-missing',
          details: ['cache file not found'],
        },
      }
    }

    if (parsed.kind === 'invalid') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'invalid-schema',
          details: ['cache schema invalid and has been reset'],
        },
      }
    }

    if (!this.isContextAware()) {
      if (parsed.kind === 'legacy') {
        return {
          data: new Set(parsed.data),
          meta: {
            hit: parsed.data.length > 0,
            reason: parsed.data.length > 0 ? 'hit' : 'context-not-found',
            details: ['legacy cache format'],
          },
        }
      }

      const union = Object.values(parsed.data.contexts).flatMap(entry => entry.values)
      return {
        data: new Set(union),
        meta: {
          hit: union.length > 0,
          reason: union.length > 0 ? 'hit' : 'context-not-found',
          schemaVersion: parsed.data.schemaVersion,
          details: ['context-less read merged all cache entries'],
        },
      }
    }

    if (parsed.kind === 'legacy') {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'legacy-schema',
          ...(this.context?.fingerprint === undefined ? {} : { fingerprint: this.context.fingerprint }),
          details: ['legacy cache schema detected; rebuilding cache with context fingerprint'],
        },
      }
    }

    if (!this.context) {
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-not-found',
          details: ['cache context missing'],
        },
      }
    }

    const entry = parsed.data.contexts[this.context.fingerprint]
    if (entry) {
      const mismatchReasons = explainContextMismatch(this.context.metadata, entry.context)
      if (mismatchReasons.length === 0) {
        return {
          data: new Set(entry.values),
          meta: {
            hit: true,
            reason: 'hit',
            fingerprint: this.context.fingerprint,
            schemaVersion: parsed.data.schemaVersion,
            details: [`context fingerprint ${this.context.fingerprint.slice(0, 12)} matched`],
          },
        }
      }

      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-mismatch',
          fingerprint: this.context.fingerprint,
          schemaVersion: parsed.data.schemaVersion,
          details: mismatchReasons,
        },
      }
    }

    const projectMatch = this.findProjectMatch(parsed.data)
    if (projectMatch) {
      const [matchedFingerprint, matchedEntry] = projectMatch
      return {
        data: new Set(),
        meta: {
          hit: false,
          reason: 'context-mismatch',
          fingerprint: this.context.fingerprint,
          schemaVersion: parsed.data.schemaVersion,
          details: [
            `nearest context fingerprint: ${matchedFingerprint.slice(0, 12)}`,
            ...explainContextMismatch(this.context.metadata, matchedEntry.context),
          ],
        },
      }
    }

    return {
      data: new Set(),
      meta: {
        hit: false,
        reason: 'context-not-found',
        fingerprint: this.context.fingerprint,
        schemaVersion: parsed.data.schemaVersion,
        details: ['context fingerprint not found in cache index'],
      },
    }
  }

  async read(): Promise<Set<string>> {
    const result = await this.readWithMeta()
    this.lastReadMeta = toReadMeta(result.meta)
    return new Set(result.data)
  }

  readSync(): Set<string> {
    const result = this.readWithMetaSync()
    this.lastReadMeta = toReadMeta(result.meta)
    return new Set(result.data)
  }

  getLastReadMeta(): CacheReadMeta {
    return toReadMeta(this.lastReadMeta)
  }

  private countEntriesFromParsed(parsed: ParsedCacheFile): { contexts: number, entries: number } {
    if (parsed.kind === 'legacy') {
      return {
        contexts: parsed.data.length ? 1 : 0,
        entries: parsed.data.length,
      }
    }

    if (parsed.kind === 'v2') {
      const values = Object.values(parsed.data.contexts)
      return {
        contexts: values.length,
        entries: values.reduce((acc, item) => acc + item.values.length, 0),
      }
    }

    return {
      contexts: 0,
      entries: 0,
    }
  }

  async clear(options?: CacheClearOptions): Promise<CacheClearResult> {
    const scope = options?.scope ?? 'current'

    if (!this.options.enabled || this.driver === 'noop') {
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved: 0,
        contextsRemoved: 0,
      }
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware() || scope === 'all') {
        const entriesRemoved = this.memoryCache?.size ?? (this.memoryIndex ? this.countEntriesFromParsed({ kind: 'v2', data: this.memoryIndex }).entries : 0)
        const contextsRemoved = this.memoryIndex ? Object.keys(this.memoryIndex.contexts).length : (this.memoryCache?.size ? 1 : 0)
        this.memoryCache = null
        this.memoryIndex = null
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved,
          contextsRemoved,
        }
      }

      if (!this.context || !this.memoryIndex) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entry = this.memoryIndex.contexts[this.context.fingerprint]
      if (!entry) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entriesRemoved = entry.values.length
      delete this.memoryIndex.contexts[this.context.fingerprint]
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved,
        contextsRemoved: 1,
      }
    }

    const result = await this.withFileLock(async () => {
      const parsed = await this.readParsedCacheFile(false)
      if (parsed.kind === 'empty') {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      if (!this.isContextAware() || scope === 'all') {
        const counts = this.countEntriesFromParsed(parsed)
        await fs.remove(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved: counts.entries,
          contextsRemoved: counts.contexts,
        }
      }

      if (parsed.kind !== 'v2' || !this.context) {
        const counts = this.countEntriesFromParsed(parsed)
        await fs.remove(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved: counts.entries,
          contextsRemoved: counts.contexts,
        }
      }

      const entry = parsed.data.contexts[this.context.fingerprint]
      if (!entry) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entriesRemoved = entry.values.length
      delete parsed.data.contexts[this.context.fingerprint]
      const remain = Object.keys(parsed.data.contexts).length
      if (remain === 0) {
        await fs.remove(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved,
          contextsRemoved: 1,
        }
      }

      parsed.data.updatedAt = new Date().toISOString()
      await this.writeIndexFile(parsed.data)
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved,
        contextsRemoved: 1,
      }
    })

    return result ?? {
      scope,
      filesRemoved: 0,
      entriesRemoved: 0,
      contextsRemoved: 0,
    }
  }

  clearSync(options?: CacheClearOptions): CacheClearResult {
    const scope = options?.scope ?? 'current'

    if (!this.options.enabled || this.driver === 'noop') {
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved: 0,
        contextsRemoved: 0,
      }
    }

    if (this.driver === 'memory') {
      if (!this.isContextAware() || scope === 'all') {
        const entriesRemoved = this.memoryCache?.size ?? (this.memoryIndex ? this.countEntriesFromParsed({ kind: 'v2', data: this.memoryIndex }).entries : 0)
        const contextsRemoved = this.memoryIndex ? Object.keys(this.memoryIndex.contexts).length : (this.memoryCache?.size ? 1 : 0)
        this.memoryCache = null
        this.memoryIndex = null
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved,
          contextsRemoved,
        }
      }

      if (!this.context || !this.memoryIndex) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entry = this.memoryIndex.contexts[this.context.fingerprint]
      if (!entry) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entriesRemoved = entry.values.length
      delete this.memoryIndex.contexts[this.context.fingerprint]
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved,
        contextsRemoved: 1,
      }
    }

    const result = this.withFileLockSync(() => {
      const parsed = this.readParsedCacheFileSync(false)
      if (parsed.kind === 'empty') {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      if (!this.isContextAware() || scope === 'all') {
        const counts = this.countEntriesFromParsed(parsed)
        fs.removeSync(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved: counts.entries,
          contextsRemoved: counts.contexts,
        }
      }

      if (parsed.kind !== 'v2' || !this.context) {
        const counts = this.countEntriesFromParsed(parsed)
        fs.removeSync(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved: counts.entries,
          contextsRemoved: counts.contexts,
        }
      }

      const entry = parsed.data.contexts[this.context.fingerprint]
      if (!entry) {
        return {
          scope,
          filesRemoved: 0,
          entriesRemoved: 0,
          contextsRemoved: 0,
        }
      }

      const entriesRemoved = entry.values.length
      delete parsed.data.contexts[this.context.fingerprint]
      const remain = Object.keys(parsed.data.contexts).length
      if (remain === 0) {
        fs.removeSync(this.options.path)
        return {
          scope,
          filesRemoved: 1,
          entriesRemoved,
          contextsRemoved: 1,
        }
      }

      parsed.data.updatedAt = new Date().toISOString()
      this.writeIndexFileSync(parsed.data)
      return {
        scope,
        filesRemoved: 0,
        entriesRemoved,
        contextsRemoved: 1,
      }
    })

    return result ?? {
      scope,
      filesRemoved: 0,
      entriesRemoved: 0,
      contextsRemoved: 0,
    }
  }

  readIndexSnapshot(): CacheIndexFileV2 | undefined {
    if (this.driver === 'memory') {
      return this.memoryIndex
        ? {
            ...this.memoryIndex,
            contexts: Object.fromEntries(Object.entries(this.memoryIndex.contexts).map(([key, value]) => [key, cloneEntry(value)])),
          }
        : undefined
    }

    const parsed = this.readParsedCacheFileSync(false)
    if (parsed.kind !== 'v2') {
      return undefined
    }

    return {
      ...parsed.data,
      contexts: Object.fromEntries(Object.entries(parsed.data.contexts).map(([key, value]) => [key, cloneEntry(value)])),
    }
  }
}

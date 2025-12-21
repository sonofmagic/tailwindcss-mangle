import type { NormalizedCacheOptions } from '../options/types'
import process from 'node:process'
import fs from 'fs-extra'
import logger from '../logger'

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function isAccessDenied(error: unknown): error is NodeJS.ErrnoException {
  return isErrnoException(error)
    && Boolean(error.code && ['EPERM', 'EBUSY', 'EACCES'].includes(error.code))
}

export class CacheStore {
  constructor(private readonly options: NormalizedCacheOptions) {}

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

  async write(data: Set<string>): Promise<string | undefined> {
    if (!this.options.enabled) {
      return undefined
    }

    const tempPath = this.createTempPath()

    try {
      await this.ensureDir()
      // Persist to a temp file first so concurrent writers never expose partial JSON
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

  writeSync(data: Set<string>): string | undefined {
    if (!this.options.enabled) {
      return undefined
    }

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

  async read(): Promise<Set<string>> {
    if (!this.options.enabled) {
      return new Set()
    }

    try {
      const exists = await fs.pathExists(this.options.path)
      if (!exists) {
        return new Set()
      }

      const data = await fs.readJSON(this.options.path)
      if (Array.isArray(data)) {
        return new Set(data.filter((item): item is string => typeof item === 'string'))
      }
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return new Set()
      }

      logger.warn('Unable to read Tailwind class cache, removing invalid file.', error)
      try {
        await fs.remove(this.options.path)
      }
      catch (cleanupError) {
        logger.error('Failed to clean up invalid cache file', cleanupError)
      }
    }

    return new Set()
  }

  readSync(): Set<string> {
    if (!this.options.enabled) {
      return new Set()
    }

    try {
      const exists = fs.pathExistsSync(this.options.path)
      if (!exists) {
        return new Set()
      }

      const data = fs.readJSONSync(this.options.path)
      if (Array.isArray(data)) {
        return new Set(data.filter((item): item is string => typeof item === 'string'))
      }
    }
    catch (error) {
      if (isErrnoException(error) && error.code === 'ENOENT') {
        return new Set()
      }

      logger.warn('Unable to read Tailwind class cache, removing invalid file.', error)
      try {
        fs.removeSync(this.options.path)
      }
      catch (cleanupError) {
        logger.error('Failed to clean up invalid cache file', cleanupError)
      }
    }

    return new Set()
  }
}

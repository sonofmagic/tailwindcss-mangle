import type { NormalizedCacheOptions } from '../options/types'
import fs from 'fs-extra'
import logger from '../logger'

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

export class CacheStore {
  constructor(private readonly options: NormalizedCacheOptions) {}

  private async ensureDir() {
    await fs.ensureDir(this.options.dir)
  }

  private ensureDirSync() {
    fs.ensureDirSync(this.options.dir)
  }

  async write(data: Set<string>): Promise<string | undefined> {
    if (!this.options.enabled) {
      return undefined
    }

    try {
      await this.ensureDir()
      await fs.writeJSON(this.options.path, Array.from(data))
      return this.options.path
    }
    catch (error) {
      logger.error('Unable to persist Tailwind class cache', error)
      return undefined
    }
  }

  writeSync(data: Set<string>): string | undefined {
    if (!this.options.enabled) {
      return undefined
    }

    try {
      this.ensureDirSync()
      fs.writeJSONSync(this.options.path, Array.from(data))
      return this.options.path
    }
    catch (error) {
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

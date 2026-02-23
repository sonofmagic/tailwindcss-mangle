import os from 'node:os'

import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { executeMigrationFile, restoreConfigEntries } from '../src/commands/migration-file-executor'
import type { MigrationWrittenEntry } from '../src/commands/migration-file-executor'

describe('executeMigrationFile', () => {
  it('returns changed entry in dry-run mode without writing files', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-exec-dry-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    try {
      const source = `export default { registry: { output: { file: 'x.json' } } }\n`
      await fs.writeFile(target, source, 'utf8')

      const wroteEntries: MigrationWrittenEntry[] = []
      const result = await executeMigrationFile({
        cwd,
        file: target,
        dryRun: true,
        rollbackOnError: true,
        wroteEntries,
      })

      expect(result.missing).toBe(false)
      expect(result.changed).toBe(true)
      expect(result.wrote).toBe(false)
      expect(result.backupWritten).toBe(false)
      expect(result.entry?.written).toBe(false)
      expect(wroteEntries).toHaveLength(0)

      const after = await fs.readFile(target, 'utf8')
      expect(after).toBe(source)
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('writes migrated content and backup file', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-exec-write-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const backupDirectory = path.resolve(cwd, '.tw-patch/migrate-backups')
    try {
      await fs.writeFile(target, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')

      const wroteEntries: MigrationWrittenEntry[] = []
      const result = await executeMigrationFile({
        cwd,
        file: target,
        dryRun: false,
        rollbackOnError: true,
        backupDirectory,
        wroteEntries,
      })

      expect(result.changed).toBe(true)
      expect(result.wrote).toBe(true)
      expect(result.backupWritten).toBe(true)
      expect(result.entry?.backupFile).toBe(path.resolve(backupDirectory, 'tailwindcss-patch.config.ts.bak'))
      expect(wroteEntries).toHaveLength(1)

      const after = await fs.readFile(target, 'utf8')
      expect(after).toContain('extract')
      expect(after).not.toContain('output')
      const backup = await fs.readFile(path.resolve(backupDirectory, 'tailwindcss-patch.config.ts.bak'), 'utf8')
      expect(backup).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('rolls back already written files when writing current file fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-exec-rollback-'))
    const first = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const second = path.resolve(cwd, 'tailwindcss-mangle.config.ts')
    try {
      await fs.writeFile(first, `export default { registry: { output: { file: 'first.json' } } }\n`, 'utf8')
      await fs.writeFile(second, `export default { registry: { output: { file: 'second.json' } } }\n`, 'utf8')

      const wroteEntries: MigrationWrittenEntry[] = []
      const firstResult = await executeMigrationFile({
        cwd,
        file: first,
        dryRun: false,
        rollbackOnError: true,
        wroteEntries,
      })
      expect(firstResult.wrote).toBe(true)

      const originalWriteFile = fs.writeFile.bind(fs)
      const writeSpy = vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
        const [target] = args
        if (String(target) === second) {
          throw new Error('simulated write failure')
        }
        return originalWriteFile(...args)
      })

      await expect(executeMigrationFile({
        cwd,
        file: second,
        dryRun: false,
        rollbackOnError: true,
        wroteEntries,
      })).rejects.toThrow('Rolled back 1 previously written file(s).')

      writeSpy.mockRestore()

      expect(wroteEntries[0]?.entry.written).toBe(false)
      expect(wroteEntries[0]?.entry.rolledBack).toBe(true)
      const firstAfter = await fs.readFile(first, 'utf8')
      const secondAfter = await fs.readFile(second, 'utf8')
      expect(firstAfter).toContain('output')
      expect(secondAfter).toContain('output')
    }
    finally {
      vi.restoreAllMocks()
      await fs.remove(cwd)
    }
  })
})

describe('restoreConfigEntries', () => {
  it('restores files and tracks skipped and missing backup entries', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-exec-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const backup = path.resolve(cwd, '.tw-patch/migrate-backups/tailwindcss-patch.config.ts.bak')
    const missingBackup = path.resolve(cwd, '.tw-patch/migrate-backups/missing.config.ts.bak')
    try {
      await fs.outputFile(target, `export default { registry: { extract: { file: 'x.json' } } }\n`, 'utf8')
      await fs.outputFile(backup, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')

      const result = await restoreConfigEntries([
        { file: target, backupFile: backup },
        { file: target, backupFile: missingBackup },
        { file: target },
      ], false)

      expect(result.scannedEntries).toBe(3)
      expect(result.restorableEntries).toBe(2)
      expect(result.restoredFiles).toBe(1)
      expect(result.missingBackups).toBe(1)
      expect(result.skippedEntries).toBe(1)
      expect(result.restored).toEqual([target])

      const restored = await fs.readFile(target, 'utf8')
      expect(restored).toContain('output')
      expect(restored).not.toContain('extract')
    }
    finally {
      await fs.remove(cwd)
    }
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMigrationCheckFailureError,
  logMigrationEntries,
  logRestoreSummary,
  logValidateSuccessSummary,
  writeMigrationReportFile,
} from '../src/commands/migration-output'
import logger from '../src/logger'

const { ensureDirMock, writeJSONMock } = vi.hoisted(() => ({
  ensureDirMock: vi.fn(async () => undefined),
  writeJSONMock: vi.fn(async () => undefined),
}))

vi.mock('fs-extra', () => {
  return {
    default: {
      ensureDir: ensureDirMock,
      writeJSON: writeJSONMock,
    },
  }
})

vi.mock('../src/logger', () => {
  return {
    default: {
      success: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('migration output helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates stable migration check failure errors', () => {
    const error = createMigrationCheckFailureError(3)
    expect(error.message).toBe('Migration check failed: 3 file(s) still need migration.')
  })

  it('writes migration report files and logs target path', async () => {
    const report = {
      reportKind: 'tw-patch-migrate-report',
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      tool: { name: 'tailwindcss-patch', version: '0.0.0' },
      cwd: '/repo',
      dryRun: false,
      rollbackOnError: true,
      scannedFiles: 1,
      changedFiles: 1,
      writtenFiles: 1,
      backupsWritten: 0,
      unchangedFiles: 0,
      missingFiles: 0,
      entries: [],
    } as any

    await writeMigrationReportFile('/repo', '.tw-patch/migrate-report.json', report)

    expect(ensureDirMock).toHaveBeenCalledWith('/repo/.tw-patch')
    expect(writeJSONMock).toHaveBeenCalledWith('/repo/.tw-patch/migrate-report.json', report, { spaces: 2 })
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('/repo/.tw-patch/migrate-report.json'))
  })

  it('logs restore summaries with preview truncation', () => {
    logRestoreSummary({
      cwd: '/repo',
      reportFile: '.tw-patch/migrate-report.json',
      dryRun: false,
      strict: false,
      scannedEntries: 6,
      restorableEntries: 6,
      restoredFiles: 6,
      missingBackups: 0,
      skippedEntries: 0,
      restored: ['/repo/a.ts', '/repo/b.ts', '/repo/c.ts', '/repo/d.ts', '/repo/e.ts', '/repo/f.ts'],
    })

    expect(logger.info).toHaveBeenCalledWith('  - /repo/a.ts')
    expect(logger.info).toHaveBeenCalledWith('  - /repo/e.ts')
    expect(logger.info).toHaveBeenCalledWith('  ...and 1 more')
  })

  it('logs validate summary and metadata details', () => {
    logValidateSuccessSummary({
      cwd: '/repo',
      reportFile: '.tw-patch/migrate-report.json',
      reportKind: 'tw-patch-migrate-report',
      reportSchemaVersion: 1,
      dryRun: true,
      strict: false,
      scannedEntries: 2,
      restorableEntries: 2,
      restoredFiles: 0,
      missingBackups: 0,
      skippedEntries: 0,
      restored: [],
    })

    expect(logger.success).toHaveBeenCalledWith(
      'Migration report validated: scanned=2, restorable=2, missingBackups=0, skipped=0',
    )
    expect(logger.info).toHaveBeenCalledWith('  metadata: kind=tw-patch-migrate-report, schema=1')
  })

  it('logs migration entry backups when backupFile is present', () => {
    logMigrationEntries({
      reportKind: 'tw-patch-migrate-report',
      schemaVersion: 1,
      generatedAt: new Date(0).toISOString(),
      tool: { name: 'tailwindcss-patch', version: '0.0.0' },
      cwd: '/repo',
      dryRun: false,
      rollbackOnError: true,
      scannedFiles: 1,
      changedFiles: 1,
      writtenFiles: 1,
      backupsWritten: 1,
      unchangedFiles: 0,
      missingFiles: 0,
      entries: [
        {
          file: '/repo/a.ts',
          changed: true,
          written: true,
          rolledBack: false,
          backupFile: '/repo/.backups/a.ts.bak',
          changes: ['root.cwd -> root.projectRoot'],
        },
      ],
    }, false)

    expect(logger.success).toHaveBeenCalledWith('Migrated: /repo/a.ts')
    expect(logger.info).toHaveBeenCalledWith('  - backup: /repo/.backups/a.ts.bak')
  })
})

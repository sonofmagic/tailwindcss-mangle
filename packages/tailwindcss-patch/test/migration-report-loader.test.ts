import os from 'node:os'

import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from '../src/commands/migration-report'
import { loadMigrationReportForRestore } from '../src/commands/migration-report-loader'

describe('migration report loader', () => {
  it('loads report metadata and normalizes entries', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-report-loader-'))
    const reportFile = path.resolve(cwd, 'migrate-report.json')
    try {
      await fs.outputJSON(reportFile, {
        reportKind: MIGRATION_REPORT_KIND,
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
        entries: [{ file: '/repo/a.ts', backupFile: '/repo/a.ts.bak' }],
      }, { spaces: 2 })

      const report = await loadMigrationReportForRestore(reportFile)
      expect(report.reportKind).toBe(MIGRATION_REPORT_KIND)
      expect(report.schemaVersion).toBe(MIGRATION_REPORT_SCHEMA_VERSION)
      expect(report.entries).toEqual([{ file: '/repo/a.ts', backupFile: '/repo/a.ts.bak' }])
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('falls back to an empty entry list when entries is invalid', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-report-loader-fallback-'))
    const reportFile = path.resolve(cwd, 'migrate-report.json')
    try {
      await fs.outputJSON(reportFile, {
        reportKind: MIGRATION_REPORT_KIND,
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
        entries: null,
      }, { spaces: 2 })

      const report = await loadMigrationReportForRestore(reportFile)
      expect(report.entries).toEqual([])
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('throws for unsupported report schema versions', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-report-loader-schema-'))
    const reportFile = path.resolve(cwd, 'migrate-report.json')
    try {
      await fs.outputJSON(reportFile, {
        reportKind: MIGRATION_REPORT_KIND,
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION + 1,
        entries: [],
      }, { spaces: 2 })

      await expect(loadMigrationReportForRestore(reportFile)).rejects.toThrow('Unsupported report schema version')
    }
    finally {
      await fs.remove(cwd)
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildMigrationReport,
  collectMigrationExecutionResult,
  createMigrationAggregationState,
} from '../src/commands/migration-aggregation'
import { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from '../src/commands/migration-report'

describe('migration aggregation helpers', () => {
  it('collects migration execution results into aggregate counters', () => {
    const state = createMigrationAggregationState()

    collectMigrationExecutionResult(state, {
      missing: true,
      changed: false,
      wrote: false,
      backupWritten: false,
    })
    collectMigrationExecutionResult(state, {
      missing: false,
      changed: false,
      wrote: false,
      backupWritten: false,
      entry: {
        file: '/repo/a.ts',
        changed: false,
        written: false,
        rolledBack: false,
        changes: [],
      },
    })
    collectMigrationExecutionResult(state, {
      missing: false,
      changed: true,
      wrote: true,
      backupWritten: true,
      entry: {
        file: '/repo/b.ts',
        changed: true,
        written: true,
        rolledBack: false,
        backupFile: '/repo/.backups/b.ts.bak',
        changes: ['registry.output -> registry.extract'],
      },
    })

    expect(state.scannedFiles).toBe(2)
    expect(state.changedFiles).toBe(1)
    expect(state.writtenFiles).toBe(1)
    expect(state.backupsWritten).toBe(1)
    expect(state.unchangedFiles).toBe(1)
    expect(state.missingFiles).toBe(1)
    expect(state.entries).toHaveLength(2)
  })

  it('builds report payload and includes optional backupDirectory only when provided', () => {
    const state = createMigrationAggregationState()
    const generatedAt = new Date(0).toISOString()

    const withBackupDir = buildMigrationReport(state, {
      cwd: '/repo',
      dryRun: false,
      rollbackOnError: true,
      backupDirectory: '/repo/.tw-patch/backups',
      toolName: 'tailwindcss-patch',
      toolVersion: '1.0.0',
      generatedAt,
    })

    expect(withBackupDir.reportKind).toBe(MIGRATION_REPORT_KIND)
    expect(withBackupDir.schemaVersion).toBe(MIGRATION_REPORT_SCHEMA_VERSION)
    expect(withBackupDir.generatedAt).toBe(generatedAt)
    expect(withBackupDir.backupDirectory).toBe('/repo/.tw-patch/backups')

    const withoutBackupDir = buildMigrationReport(state, {
      cwd: '/repo',
      dryRun: true,
      rollbackOnError: false,
      toolName: 'tailwindcss-patch',
      toolVersion: '1.0.0',
      generatedAt,
    })

    expect('backupDirectory' in withoutBackupDir).toBe(false)
  })
})

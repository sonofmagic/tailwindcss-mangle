import type { ExecuteMigrationFileResult } from './migration-file-executor'
import type { ConfigFileMigrationEntry, ConfigFileMigrationReport } from './migration-types'
import {
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
} from './migration-report'

export interface MigrationAggregationState {
  scannedFiles: number
  changedFiles: number
  writtenFiles: number
  backupsWritten: number
  unchangedFiles: number
  missingFiles: number
  entries: ConfigFileMigrationEntry[]
}

export interface BuildMigrationReportContext {
  cwd: string
  dryRun: boolean
  rollbackOnError: boolean
  backupDirectory?: string
  toolName: string
  toolVersion: string
  generatedAt?: string
}

export function createMigrationAggregationState(): MigrationAggregationState {
  return {
    scannedFiles: 0,
    changedFiles: 0,
    writtenFiles: 0,
    backupsWritten: 0,
    unchangedFiles: 0,
    missingFiles: 0,
    entries: [],
  }
}

export function collectMigrationExecutionResult(
  state: MigrationAggregationState,
  result: ExecuteMigrationFileResult,
) {
  if (result.missing) {
    state.missingFiles += 1
    return
  }

  state.scannedFiles += 1
  state.entries.push(result.entry)

  if (result.changed) {
    state.changedFiles += 1
    if (result.wrote) {
      state.writtenFiles += 1
    }
    if (result.backupWritten) {
      state.backupsWritten += 1
    }
  }
  else {
    state.unchangedFiles += 1
  }
}

export function buildMigrationReport(
  state: MigrationAggregationState,
  context: BuildMigrationReportContext,
): ConfigFileMigrationReport {
  const {
    cwd,
    dryRun,
    rollbackOnError,
    backupDirectory,
    toolName,
    toolVersion,
    generatedAt = new Date().toISOString(),
  } = context

  return {
    reportKind: MIGRATION_REPORT_KIND,
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    generatedAt,
    tool: {
      name: toolName,
      version: toolVersion,
    },
    cwd,
    dryRun,
    rollbackOnError,
    ...(backupDirectory ? { backupDirectory } : {}),
    scannedFiles: state.scannedFiles,
    changedFiles: state.changedFiles,
    writtenFiles: state.writtenFiles,
    backupsWritten: state.backupsWritten,
    unchangedFiles: state.unchangedFiles,
    missingFiles: state.missingFiles,
    entries: state.entries,
  }
}

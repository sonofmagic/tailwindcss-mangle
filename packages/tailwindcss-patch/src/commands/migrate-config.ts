import type { MigrationWrittenEntry } from './migration-file-executor'
import type {
  ConfigFileMigrationReport,
  MigrateConfigFilesOptions,
  RestoreConfigFilesOptions,
  RestoreConfigFilesResult,
} from './migration-types'
import path from 'pathe'
import { pkgName, pkgVersion } from '../constants'
import {
  buildMigrationReport,
  collectMigrationExecutionResult,
  createMigrationAggregationState,
} from './migration-aggregation'
import { executeMigrationFile, restoreConfigEntries } from './migration-file-executor'

import { loadMigrationReportForRestore } from './migration-report-loader'
import { resolveMigrationTargetFiles } from './migration-target-resolver'

export { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from './migration-report'
export { migrateConfigSource } from './migration-source'
export type { ConfigSourceMigrationResult } from './migration-source'
export { DEFAULT_CONFIG_FILENAMES } from './migration-target-files'
export type {
  ConfigFileMigrationEntry,
  ConfigFileMigrationReport,
  MigrateConfigFilesOptions,
  RestoreConfigFilesOptions,
  RestoreConfigFilesResult,
} from './migration-types'

export async function migrateConfigFiles(options: MigrateConfigFilesOptions): Promise<ConfigFileMigrationReport> {
  const cwd = path.resolve(options.cwd)
  const dryRun = options.dryRun ?? false
  const rollbackOnError = options.rollbackOnError ?? true
  const backupDirectory = options.backupDir ? path.resolve(cwd, options.backupDir) : undefined
  const targetFiles = await resolveMigrationTargetFiles({
    cwd,
    files: options.files,
    workspace: options.workspace,
    maxDepth: options.maxDepth,
    include: options.include,
    exclude: options.exclude,
  })
  const aggregation = createMigrationAggregationState()
  const wroteEntries: MigrationWrittenEntry[] = []

  for (const file of targetFiles) {
    const result = await executeMigrationFile({
      cwd,
      file,
      dryRun,
      rollbackOnError,
      wroteEntries,
      ...(backupDirectory ? { backupDirectory } : {}),
    })
    collectMigrationExecutionResult(aggregation, result)
  }

  return buildMigrationReport(aggregation, {
    cwd,
    dryRun,
    rollbackOnError,
    ...(backupDirectory ? { backupDirectory } : {}),
    toolName: pkgName,
    toolVersion: pkgVersion,
  })
}

export async function restoreConfigFiles(options: RestoreConfigFilesOptions): Promise<RestoreConfigFilesResult> {
  const cwd = path.resolve(options.cwd)
  const dryRun = options.dryRun ?? false
  const strict = options.strict ?? false
  const reportFile = path.resolve(cwd, options.reportFile)

  const report = await loadMigrationReportForRestore(reportFile)
  const {
    scannedEntries,
    restorableEntries,
    restoredFiles,
    missingBackups,
    skippedEntries,
    restored,
  } = await restoreConfigEntries(report.entries, dryRun)

  if (strict && missingBackups > 0) {
    throw new Error(`Restore failed: ${missingBackups} backup file(s) missing in report ${reportFile}.`)
  }

  return {
    cwd,
    reportFile,
    ...(report.reportKind === undefined ? {} : { reportKind: report.reportKind }),
    ...(report.schemaVersion === undefined ? {} : { reportSchemaVersion: report.schemaVersion }),
    dryRun,
    strict,
    scannedEntries,
    restorableEntries,
    restoredFiles,
    missingBackups,
    skippedEntries,
    restored,
  }
}

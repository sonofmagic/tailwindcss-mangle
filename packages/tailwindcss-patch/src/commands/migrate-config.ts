import path from 'pathe'
import { pkgName, pkgVersion } from '../constants'
import { executeMigrationFile, restoreConfigEntries } from './migration-file-executor'
import type { MigrationWrittenEntry } from './migration-file-executor'
import { loadMigrationReportForRestore } from './migration-report-loader'
import {
  collectWorkspaceConfigFiles,
  DEFAULT_WORKSPACE_MAX_DEPTH,
  filterTargetFiles,
  resolveTargetFiles,
} from './migration-target-files'
import {
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
} from './migration-report'
import { migrateConfigSource } from './migration-source'
import type {
  ConfigFileMigrationEntry,
  ConfigFileMigrationReport,
  MigrateConfigFilesOptions,
  RestoreConfigFilesOptions,
  RestoreConfigFilesResult,
} from './migration-types'
export { DEFAULT_CONFIG_FILENAMES } from './migration-target-files'
export { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from './migration-report'
export { migrateConfigSource } from './migration-source'
export type { ConfigSourceMigrationResult } from './migration-source'
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
  const maxDepth = options.maxDepth ?? DEFAULT_WORKSPACE_MAX_DEPTH
  const discoveredTargetFiles = options.files && options.files.length > 0
    ? resolveTargetFiles(cwd, options.files)
    : options.workspace
      ? await collectWorkspaceConfigFiles(cwd, maxDepth)
      : resolveTargetFiles(cwd)
  const targetFiles = filterTargetFiles(discoveredTargetFiles, cwd, options.include, options.exclude)
  const entries: ConfigFileMigrationEntry[] = []

  let scannedFiles = 0
  let changedFiles = 0
  let writtenFiles = 0
  let backupsWritten = 0
  let unchangedFiles = 0
  let missingFiles = 0
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

    if (result.missing) {
      missingFiles += 1
      continue
    }

    scannedFiles += 1
    entries.push(result.entry)

    if (result.changed) {
      changedFiles += 1
      if (result.wrote) {
        writtenFiles += 1
      }
      if (result.backupWritten) {
        backupsWritten += 1
      }
    }
    else {
      unchangedFiles += 1
    }
  }

  return {
    reportKind: MIGRATION_REPORT_KIND,
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    tool: {
      name: pkgName,
      version: pkgVersion,
    },
    cwd,
    dryRun,
    rollbackOnError,
    ...(backupDirectory ? { backupDirectory } : {}),
    scannedFiles,
    changedFiles,
    writtenFiles,
    backupsWritten,
    unchangedFiles,
    missingFiles,
    entries,
  }
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

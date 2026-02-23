import type { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from './migration-report'

export interface ConfigFileMigrationEntry {
  file: string
  changed: boolean
  written: boolean
  rolledBack: boolean
  backupFile?: string
  changes: string[]
}

export interface ConfigFileMigrationReport {
  reportKind: typeof MIGRATION_REPORT_KIND
  schemaVersion: typeof MIGRATION_REPORT_SCHEMA_VERSION
  generatedAt: string
  tool: {
    name: string
    version: string
  }
  cwd: string
  dryRun: boolean
  rollbackOnError: boolean
  backupDirectory?: string
  scannedFiles: number
  changedFiles: number
  writtenFiles: number
  backupsWritten: number
  unchangedFiles: number
  missingFiles: number
  entries: ConfigFileMigrationEntry[]
}

export interface MigrateConfigFilesOptions {
  cwd: string
  files?: string[]
  dryRun?: boolean
  workspace?: boolean
  maxDepth?: number
  rollbackOnError?: boolean
  backupDir?: string
  include?: string[]
  exclude?: string[]
}

export interface RestoreConfigFilesOptions {
  cwd: string
  reportFile: string
  dryRun?: boolean
  strict?: boolean
}

export interface RestoreConfigFilesResult {
  cwd: string
  reportFile: string
  reportKind?: string
  reportSchemaVersion?: number
  dryRun: boolean
  strict: boolean
  scannedEntries: number
  restorableEntries: number
  restoredFiles: number
  missingBackups: number
  skippedEntries: number
  restored: string[]
}

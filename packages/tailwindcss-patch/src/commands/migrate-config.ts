import fs from 'fs-extra'
import path from 'pathe'
import { pkgName, pkgVersion } from '../constants'
import {
  collectWorkspaceConfigFiles,
  DEFAULT_WORKSPACE_MAX_DEPTH,
  filterTargetFiles,
  resolveBackupRelativePath,
  resolveTargetFiles,
} from './migration-target-files'
import {
  assertMigrationReportCompatibility,
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
} from './migration-report'
import { migrateConfigSource } from './migration-source'
export { DEFAULT_CONFIG_FILENAMES } from './migration-target-files'
export { MIGRATION_REPORT_KIND, MIGRATION_REPORT_SCHEMA_VERSION } from './migration-report'
export { migrateConfigSource } from './migration-source'
export type { ConfigSourceMigrationResult } from './migration-source'

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
  const wroteEntries: Array<{ file: string, source: string, entry: ConfigFileMigrationEntry }> = []

  for (const file of targetFiles) {
    const exists = await fs.pathExists(file)
    if (!exists) {
      missingFiles += 1
      continue
    }

    scannedFiles += 1
    const source = await fs.readFile(file, 'utf8')
    const migrated = migrateConfigSource(source)

    const entry: ConfigFileMigrationEntry = {
      file,
      changed: migrated.changed,
      written: false,
      rolledBack: false,
      changes: migrated.changes,
    }
    entries.push(entry)

    if (migrated.changed) {
      changedFiles += 1
      if (!dryRun) {
        try {
          if (backupDirectory) {
            const backupRelativePath = resolveBackupRelativePath(cwd, file)
            const backupFile = path.resolve(backupDirectory, backupRelativePath)
            await fs.ensureDir(path.dirname(backupFile))
            await fs.writeFile(backupFile, source, 'utf8')
            entry.backupFile = backupFile
            backupsWritten += 1
          }
          await fs.writeFile(file, migrated.code, 'utf8')
          entry.written = true
          wroteEntries.push({ file, source, entry })
          writtenFiles += 1
        }
        catch (error) {
          let rollbackCount = 0
          if (rollbackOnError && wroteEntries.length > 0) {
            for (const written of [...wroteEntries].reverse()) {
              try {
                await fs.writeFile(written.file, written.source, 'utf8')
                written.entry.written = false
                written.entry.rolledBack = true
                rollbackCount += 1
              }
              catch {
                // Continue best-effort rollback to avoid leaving even more partial state.
              }
            }
            writtenFiles = Math.max(0, writtenFiles - rollbackCount)
          }
          const reason = error instanceof Error ? error.message : String(error)
          const rollbackHint = rollbackOnError && rollbackCount > 0
            ? ` Rolled back ${rollbackCount} previously written file(s).`
            : ''
          throw new Error(`Failed to write migrated config "${file}": ${reason}.${rollbackHint}`)
        }
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

  const report = await fs.readJSON(reportFile) as {
    reportKind?: string
    schemaVersion?: number
    entries?: Array<{ file?: string, backupFile?: string }>
  }
  assertMigrationReportCompatibility(report, reportFile)
  const entries = Array.isArray(report.entries) ? report.entries : []

  let scannedEntries = 0
  let restorableEntries = 0
  let restoredFiles = 0
  let missingBackups = 0
  let skippedEntries = 0
  const restored: string[] = []

  for (const entry of entries) {
    scannedEntries += 1
    const targetFile = entry.file ? path.resolve(entry.file) : undefined
    const backupFile = entry.backupFile ? path.resolve(entry.backupFile) : undefined

    if (!targetFile || !backupFile) {
      skippedEntries += 1
      continue
    }

    restorableEntries += 1

    const backupExists = await fs.pathExists(backupFile)
    if (!backupExists) {
      missingBackups += 1
      continue
    }

    if (!dryRun) {
      const backupContent = await fs.readFile(backupFile, 'utf8')
      await fs.ensureDir(path.dirname(targetFile))
      await fs.writeFile(targetFile, backupContent, 'utf8')
    }

    restoredFiles += 1
    restored.push(targetFile)
  }

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

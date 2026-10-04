import type { ConfigFileMigrationEntry } from './migration-types'
import { restoreConfigEntriesNative, rollbackMigrationWritesNative, writeMigrationFileNative } from '@tailwindcss-mangle/native'
import fs from 'fs-extra'

import path from 'pathe'
import { migrateConfigSource } from './migration-source'
import { resolveBackupRelativePath } from './migration-target-files'

export type MigrationExecutionEntry = ConfigFileMigrationEntry

export interface MigrationWrittenEntry {
  file: string
  source: string
  entry: MigrationExecutionEntry
}

export interface ExecuteMigrationFileOptions {
  cwd: string
  file: string
  dryRun: boolean
  rollbackOnError: boolean
  backupDirectory?: string
  wroteEntries: MigrationWrittenEntry[]
}

export type ExecuteMigrationFileResult
  = | {
    missing: true
    changed: false
    wrote: false
    backupWritten: false
  }
  | {
    missing: false
    changed: boolean
    wrote: boolean
    backupWritten: boolean
    entry: MigrationExecutionEntry
  }

export async function rollbackWrittenEntries(wroteEntries: MigrationWrittenEntry[]) {
  const restored = await rollbackMigrationWritesNative(wroteEntries.map(({ file, source }) => ({ file, source })))
  for (const index of restored) {
    const written = wroteEntries[index]!
    written.entry.written = false
    written.entry.rolledBack = true
  }
  return restored.length
}

export async function executeMigrationFile(options: ExecuteMigrationFileOptions): Promise<ExecuteMigrationFileResult> {
  const {
    cwd,
    file,
    dryRun,
    rollbackOnError,
    backupDirectory,
    wroteEntries,
  } = options

  const exists = await fs.pathExists(file)
  if (!exists) {
    return {
      missing: true,
      changed: false,
      wrote: false,
      backupWritten: false,
    }
  }

  const source = await fs.readFile(file, 'utf8')
  const migrated = migrateConfigSource(source)
  const entry: MigrationExecutionEntry = {
    file,
    changed: migrated.changed,
    written: false,
    rolledBack: false,
    changes: migrated.changes,
  }

  if (!migrated.changed || dryRun) {
    return {
      missing: false,
      changed: migrated.changed,
      wrote: false,
      backupWritten: false,
      entry,
    }
  }

  let backupWritten = false
  try {
    const backupFile = backupDirectory
      ? path.resolve(backupDirectory, resolveBackupRelativePath(cwd, file))
      : undefined
    backupWritten = await writeMigrationFileNative(file, source, migrated.code, backupFile)
    if (backupFile) {
      entry.backupFile = backupFile
    }
    entry.written = true
    wroteEntries.push({ file, source, entry })

    return {
      missing: false,
      changed: true,
      wrote: true,
      backupWritten,
      entry,
    }
  }
  catch (error) {
    const rollbackCount = rollbackOnError && wroteEntries.length > 0
      ? await rollbackWrittenEntries(wroteEntries)
      : 0
    const reason = error instanceof Error ? error.message : String(error)
    const rollbackHint = rollbackOnError && rollbackCount > 0
      ? ` Rolled back ${rollbackCount} previously written file(s).`
      : ''
    throw new Error(`Failed to write migrated config "${file}": ${reason}.${rollbackHint}`)
  }
}

export interface RestoreReportEntry {
  file?: string
  backupFile?: string
}

export interface RestoreEntriesResult {
  scannedEntries: number
  restorableEntries: number
  restoredFiles: number
  missingBackups: number
  skippedEntries: number
  restored: string[]
}

export async function restoreConfigEntries(entries: RestoreReportEntry[], dryRun: boolean): Promise<RestoreEntriesResult> {
  return restoreConfigEntriesNative(entries.map(entry => ({
    ...(entry.file ? { file: path.resolve(entry.file) } : {}),
    ...(entry.backupFile ? { backupFile: path.resolve(entry.backupFile) } : {}),
  })), dryRun)
}

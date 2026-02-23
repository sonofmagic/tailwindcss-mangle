import type { ConfigFileMigrationEntry } from './migration-types'
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
  let rollbackCount = 0
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
  return rollbackCount
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
    if (backupDirectory) {
      const backupRelativePath = resolveBackupRelativePath(cwd, file)
      const backupFile = path.resolve(backupDirectory, backupRelativePath)
      await fs.ensureDir(path.dirname(backupFile))
      await fs.writeFile(backupFile, source, 'utf8')
      entry.backupFile = backupFile
      backupWritten = true
    }

    await fs.writeFile(file, migrated.code, 'utf8')
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

  return {
    scannedEntries,
    restorableEntries,
    restoredFiles,
    missingBackups,
    skippedEntries,
    restored,
  }
}

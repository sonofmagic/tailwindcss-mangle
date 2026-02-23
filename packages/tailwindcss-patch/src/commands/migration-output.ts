import type { ConfigFileMigrationReport, RestoreConfigFilesResult } from './migration-types'
import type { ValidateFailureSummary, ValidateJsonFailurePayload, ValidateJsonSuccessPayload } from './validate'

import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'

function formatPathForLog(file: string) {
  return file.replace(process.cwd(), '.')
}

export function createMigrationCheckFailureError(changedFiles: number) {
  return new Error(`Migration check failed: ${changedFiles} file(s) still need migration.`)
}

export async function writeMigrationReportFile(
  cwd: string,
  reportFile: string,
  report: ConfigFileMigrationReport,
) {
  const reportPath = path.resolve(cwd, reportFile)
  await fs.ensureDir(path.dirname(reportPath))
  await fs.writeJSON(reportPath, report, { spaces: 2 })
  logger.info(`Migration report written: ${formatPathForLog(reportPath)}`)
}

export function logMigrationReportAsJson(report: ConfigFileMigrationReport) {
  logger.log(JSON.stringify(report, null, 2))
}

export function logNoMigrationConfigFilesWarning() {
  logger.warn('No config files found for migration.')
}

export function logMigrationEntries(report: ConfigFileMigrationReport, dryRun: boolean) {
  for (const entry of report.entries) {
    const fileLabel = formatPathForLog(entry.file)
    if (!entry.changed) {
      logger.info(`No changes: ${fileLabel}`)
      continue
    }
    if (dryRun) {
      logger.info(`[dry-run] ${fileLabel}`)
    }
    else {
      logger.success(`Migrated: ${fileLabel}`)
    }
    for (const change of entry.changes) {
      logger.info(`  - ${change}`)
    }
    if (entry.backupFile) {
      logger.info(`  - backup: ${formatPathForLog(entry.backupFile)}`)
    }
  }
}

export function logMigrationSummary(report: ConfigFileMigrationReport) {
  logger.info(
    `Migration summary: scanned=${report.scannedFiles}, changed=${report.changedFiles}, written=${report.writtenFiles}, backups=${report.backupsWritten}, missing=${report.missingFiles}, unchanged=${report.unchangedFiles}`,
  )
}

export function logRestoreResultAsJson(result: RestoreConfigFilesResult) {
  logger.log(JSON.stringify(result, null, 2))
}

export function logRestoreSummary(result: RestoreConfigFilesResult) {
  logger.info(
    `Restore summary: scanned=${result.scannedEntries}, restorable=${result.restorableEntries}, restored=${result.restoredFiles}, missingBackups=${result.missingBackups}, skipped=${result.skippedEntries}`,
  )
  if (result.restored.length > 0) {
    const preview = result.restored.slice(0, 5)
    for (const file of preview) {
      logger.info(`  - ${formatPathForLog(file)}`)
    }
    if (result.restored.length > preview.length) {
      logger.info(`  ...and ${result.restored.length - preview.length} more`)
    }
  }
}

export function logValidateSuccessAsJson(result: RestoreConfigFilesResult) {
  const payload: ValidateJsonSuccessPayload = {
    ok: true,
    ...result,
  }
  logger.log(JSON.stringify(payload, null, 2))
}

export function logValidateSuccessSummary(result: RestoreConfigFilesResult) {
  logger.success(
    `Migration report validated: scanned=${result.scannedEntries}, restorable=${result.restorableEntries}, missingBackups=${result.missingBackups}, skipped=${result.skippedEntries}`,
  )

  if (result.reportKind || result.reportSchemaVersion !== undefined) {
    const kind = result.reportKind ?? 'unknown'
    const schema = result.reportSchemaVersion === undefined ? 'unknown' : String(result.reportSchemaVersion)
    logger.info(`  metadata: kind=${kind}, schema=${schema}`)
  }
}

export function logValidateFailureAsJson(summary: ValidateFailureSummary) {
  const payload: ValidateJsonFailurePayload = {
    ok: false,
    reason: summary.reason,
    exitCode: summary.exitCode,
    message: summary.message,
  }
  logger.log(JSON.stringify(payload, null, 2))
}

export function logValidateFailureSummary(summary: ValidateFailureSummary) {
  logger.error(`Validation failed [${summary.reason}] (exit ${summary.exitCode}): ${summary.message}`)
}

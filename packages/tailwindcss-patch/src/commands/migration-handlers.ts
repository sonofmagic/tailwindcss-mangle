import type { TailwindcssPatchCommandContext } from './types'
import type { ValidateJsonFailurePayload, ValidateJsonSuccessPayload } from './validate'

import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import logger from '../logger'
import { migrateConfigFiles, restoreConfigFiles } from './migrate-config'
import { classifyValidateError, ValidateCommandError } from './validate'

function normalizePatternArgs(value?: string | string[]) {
  if (!value) {
    return undefined
  }
  const raw = Array.isArray(value) ? value : [value]
  const values = raw
    .flatMap(item => item.split(','))
    .map(item => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

export async function migrateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'migrate'>) {
  const { args } = ctx
  const include = normalizePatternArgs(args.include)
  const exclude = normalizePatternArgs(args.exclude)
  const parsedMaxDepth = args.maxDepth === undefined ? undefined : Number(args.maxDepth)
  const maxDepth = parsedMaxDepth !== undefined && Number.isFinite(parsedMaxDepth) && parsedMaxDepth >= 0
    ? Math.floor(parsedMaxDepth)
    : undefined
  const checkMode = args.check ?? false
  const dryRun = args.dryRun ?? checkMode
  if (args.workspace && args.maxDepth !== undefined && maxDepth === undefined) {
    logger.warn(`Invalid --max-depth value "${String(args.maxDepth)}", fallback to default depth.`)
  }
  const report = await migrateConfigFiles({
    cwd: ctx.cwd,
    dryRun,
    ...(args.config ? { files: [args.config] } : {}),
    ...(args.workspace ? { workspace: true } : {}),
    ...(args.workspace && maxDepth !== undefined ? { maxDepth } : {}),
    ...(args.backupDir ? { backupDir: args.backupDir } : {}),
    ...(include ? { include } : {}),
    ...(exclude ? { exclude } : {}),
  })

  if (args.reportFile) {
    const reportPath = path.resolve(ctx.cwd, args.reportFile)
    await fs.ensureDir(path.dirname(reportPath))
    await fs.writeJSON(reportPath, report, { spaces: 2 })
    logger.info(`Migration report written: ${reportPath.replace(process.cwd(), '.')}`)
  }

  if (args.json) {
    logger.log(JSON.stringify(report, null, 2))
    if (checkMode && report.changedFiles > 0) {
      throw new Error(`Migration check failed: ${report.changedFiles} file(s) still need migration.`)
    }
    if (report.scannedFiles === 0) {
      logger.warn('No config files found for migration.')
    }
    return report
  }

  if (report.scannedFiles === 0) {
    logger.warn('No config files found for migration.')
    return report
  }

  for (const entry of report.entries) {
    const fileLabel = entry.file.replace(process.cwd(), '.')
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
      logger.info(`  - backup: ${entry.backupFile.replace(process.cwd(), '.')}`)
    }
  }

  logger.info(
    `Migration summary: scanned=${report.scannedFiles}, changed=${report.changedFiles}, written=${report.writtenFiles}, backups=${report.backupsWritten}, missing=${report.missingFiles}, unchanged=${report.unchangedFiles}`,
  )

  if (checkMode && report.changedFiles > 0) {
    throw new Error(`Migration check failed: ${report.changedFiles} file(s) still need migration.`)
  }
  return report
}

export async function restoreCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'restore'>) {
  const { args } = ctx
  const reportFile = args.reportFile ?? '.tw-patch/migrate-report.json'
  const result = await restoreConfigFiles({
    cwd: ctx.cwd,
    reportFile,
    dryRun: args.dryRun ?? false,
    strict: args.strict ?? false,
  })

  if (args.json) {
    logger.log(JSON.stringify(result, null, 2))
    return result
  }

  logger.info(
    `Restore summary: scanned=${result.scannedEntries}, restorable=${result.restorableEntries}, restored=${result.restoredFiles}, missingBackups=${result.missingBackups}, skipped=${result.skippedEntries}`,
  )
  if (result.restored.length > 0) {
    const preview = result.restored.slice(0, 5)
    for (const file of preview) {
      logger.info(`  - ${file.replace(process.cwd(), '.')}`)
    }
    if (result.restored.length > preview.length) {
      logger.info(`  ...and ${result.restored.length - preview.length} more`)
    }
  }
  return result
}

export async function validateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'validate'>) {
  const { args } = ctx
  const reportFile = args.reportFile ?? '.tw-patch/migrate-report.json'
  try {
    const result = await restoreConfigFiles({
      cwd: ctx.cwd,
      reportFile,
      dryRun: true,
      strict: args.strict ?? false,
    })

    if (args.json) {
      const payload: ValidateJsonSuccessPayload = {
        ok: true,
        ...result,
      }
      logger.log(JSON.stringify(payload, null, 2))
      return result
    }

    logger.success(
      `Migration report validated: scanned=${result.scannedEntries}, restorable=${result.restorableEntries}, missingBackups=${result.missingBackups}, skipped=${result.skippedEntries}`,
    )

    if (result.reportKind || result.reportSchemaVersion !== undefined) {
      const kind = result.reportKind ?? 'unknown'
      const schema = result.reportSchemaVersion === undefined ? 'unknown' : String(result.reportSchemaVersion)
      logger.info(`  metadata: kind=${kind}, schema=${schema}`)
    }
    return result
  }
  catch (error) {
    const summary = classifyValidateError(error)
    if (args.json) {
      const payload: ValidateJsonFailurePayload = {
        ok: false,
        reason: summary.reason,
        exitCode: summary.exitCode,
        message: summary.message,
      }
      logger.log(JSON.stringify(payload, null, 2))
    }
    else {
      logger.error(`Validation failed [${summary.reason}] (exit ${summary.exitCode}): ${summary.message}`)
    }
    throw new ValidateCommandError(summary, { cause: error })
  }
}

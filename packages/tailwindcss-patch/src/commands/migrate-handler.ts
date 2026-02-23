import type { TailwindcssPatchCommandContext } from './types'

import logger from '../logger'
import { migrateConfigFiles } from './migrate-config'
import { resolveMigrateCommandArgs } from './migration-args'
import {
  createMigrationCheckFailureError,
  logMigrationEntries,
  logMigrationReportAsJson,
  logMigrationSummary,
  logNoMigrationConfigFilesWarning,
  writeMigrationReportFile,
} from './migration-output'

export async function migrateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'migrate'>) {
  const { args } = ctx
  const {
    include,
    exclude,
    maxDepth,
    checkMode,
    dryRun,
    hasInvalidMaxDepth,
  } = resolveMigrateCommandArgs(args)

  if (args.workspace && hasInvalidMaxDepth) {
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
    await writeMigrationReportFile(ctx.cwd, args.reportFile, report)
  }

  if (args.json) {
    logMigrationReportAsJson(report)
    if (checkMode && report.changedFiles > 0) {
      throw createMigrationCheckFailureError(report.changedFiles)
    }
    if (report.scannedFiles === 0) {
      logNoMigrationConfigFilesWarning()
    }
    return report
  }

  if (report.scannedFiles === 0) {
    logNoMigrationConfigFilesWarning()
    return report
  }

  logMigrationEntries(report, dryRun)
  logMigrationSummary(report)

  if (checkMode && report.changedFiles > 0) {
    throw createMigrationCheckFailureError(report.changedFiles)
  }
  return report
}

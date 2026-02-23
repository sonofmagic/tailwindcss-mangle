import type { TailwindcssPatchCommandContext } from './types'

import logger from '../logger'
import { migrateConfigFiles, restoreConfigFiles } from './migrate-config'
import {
  resolveMigrateCommandArgs,
  resolveRestoreCommandArgs,
  resolveValidateCommandArgs,
} from './migration-args'
import {
  createMigrationCheckFailureError,
  logMigrationEntries,
  logMigrationReportAsJson,
  logMigrationSummary,
  logNoMigrationConfigFilesWarning,
  logRestoreResultAsJson,
  logRestoreSummary,
  logValidateFailureAsJson,
  logValidateFailureSummary,
  logValidateSuccessAsJson,
  logValidateSuccessSummary,
  writeMigrationReportFile,
} from './migration-output'
import { classifyValidateError, ValidateCommandError } from './validate'

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

export async function restoreCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'restore'>) {
  const { args } = ctx
  const restoreArgs = resolveRestoreCommandArgs(args)
  const result = await restoreConfigFiles({
    cwd: ctx.cwd,
    reportFile: restoreArgs.reportFile,
    dryRun: restoreArgs.dryRun,
    strict: restoreArgs.strict,
  })

  if (args.json) {
    logRestoreResultAsJson(result)
    return result
  }

  logRestoreSummary(result)
  return result
}

export async function validateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'validate'>) {
  const { args } = ctx
  const validateArgs = resolveValidateCommandArgs(args)
  try {
    const result = await restoreConfigFiles({
      cwd: ctx.cwd,
      reportFile: validateArgs.reportFile,
      dryRun: true,
      strict: validateArgs.strict,
    })

    if (args.json) {
      logValidateSuccessAsJson(result)
      return result
    }

    logValidateSuccessSummary(result)
    return result
  }
  catch (error) {
    const summary = classifyValidateError(error)
    if (args.json) {
      logValidateFailureAsJson(summary)
    }
    else {
      logValidateFailureSummary(summary)
    }
    throw new ValidateCommandError(summary, { cause: error })
  }
}

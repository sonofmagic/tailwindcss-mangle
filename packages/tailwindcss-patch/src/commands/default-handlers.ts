import type { PatchStatusReport, TailwindcssPatchOptions } from '../types'
import type { TailwindcssPatchCommandContext } from './cli'
import type { TokenGroupKey, TokenOutputFormat } from './token-output'
import type { ValidateJsonFailurePayload, ValidateJsonSuccessPayload } from './validate'

import process from 'node:process'
import fs from 'fs-extra'
import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadWorkspaceConfigModule } from '../config/workspace'
import { groupTokensByFile } from '../extraction/candidate-extractor'
import logger from '../logger'
import { migrateConfigFiles, restoreConfigFiles } from './migrate-config'
import {
  DEFAULT_TOKEN_REPORT,
  formatGroupedPreview,
  formatTokenLine,
  TOKEN_FORMATS,
} from './token-output'
import { classifyValidateError, ValidateCommandError } from './validate'

const DEFAULT_CONFIG_NAME = 'tailwindcss-mangle'

export async function installCommandDefaultHandler(_ctx: TailwindcssPatchCommandContext<'install'>) {
  const patcher = new TailwindcssPatcher()
  await patcher.patch()
  logger.success('Tailwind CSS runtime patched successfully.')
}

export async function extractCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'extract'>) {
  const { args } = ctx
  const overrides: TailwindcssPatchOptions = {}
  let hasOverrides = false

  if (args.output || args.format) {
    overrides.extract = {
      ...(args.output === undefined ? {} : { file: args.output }),
      ...(args.format === undefined ? {} : { format: args.format }),
    }
    hasOverrides = true
  }

  if (args.css) {
    overrides.tailwindcss = {
      v4: {
        cssEntries: [args.css],
      },
    }
    hasOverrides = true
  }

  const patcher = await ctx.createPatcher(hasOverrides ? overrides : undefined)
  const extractOptions = args.write === undefined ? {} : { write: args.write }
  const result = await patcher.extract(extractOptions)

  if (result.filename) {
    logger.success(`Collected ${result.classList.length} classes → ${result.filename}`)
  }
  else {
    logger.success(`Collected ${result.classList.length} classes.`)
  }

  return result
}

export async function tokensCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'tokens'>) {
  const { args } = ctx
  const patcher = await ctx.createPatcher()
  const report = await patcher.collectContentTokens()

  const shouldWrite = args.write ?? true
  let format: TokenOutputFormat = args.format ?? 'json'
  if (!TOKEN_FORMATS.includes(format)) {
    format = 'json'
  }
  const targetFile = args.output ?? DEFAULT_TOKEN_REPORT
  const groupKey: TokenGroupKey = args.groupKey === 'absolute' ? 'absolute' : 'relative'
  const buildGrouped = () =>
    groupTokensByFile(report, {
      key: groupKey,
      stripAbsolutePaths: groupKey !== 'absolute',
    })
  const grouped = format === 'grouped-json' ? buildGrouped() : null
  const resolveGrouped = () => grouped ?? buildGrouped()

  if (shouldWrite) {
    const target = path.resolve(targetFile)
    await fs.ensureDir(path.dirname(target))
    if (format === 'json') {
      await fs.writeJSON(target, report, { spaces: 2 })
    }
    else if (format === 'grouped-json') {
      await fs.writeJSON(target, resolveGrouped(), { spaces: 2 })
    }
    else {
      const lines = report.entries.map(formatTokenLine)
      await fs.writeFile(target, `${lines.join('\n')}\n`, 'utf8')
    }
    logger.success(`Collected ${report.entries.length} tokens (${format}) → ${target.replace(process.cwd(), '.')}`)
  }
  else {
    logger.success(`Collected ${report.entries.length} tokens from ${report.filesScanned} files.`)
    if (format === 'lines') {
      const preview = report.entries.slice(0, 5).map(formatTokenLine).join('\n')
      if (preview) {
        logger.log('')
        logger.info(preview)
        if (report.entries.length > 5) {
          logger.info(`…and ${report.entries.length - 5} more.`)
        }
      }
    }
    else if (format === 'grouped-json') {
      const map = resolveGrouped()
      const { preview, moreFiles } = formatGroupedPreview(map)
      if (preview) {
        logger.log('')
        logger.info(preview)
        if (moreFiles > 0) {
          logger.info(`…and ${moreFiles} more files.`)
        }
      }
    }
    else {
      const previewEntries = report.entries.slice(0, 3)
      if (previewEntries.length) {
        logger.log('')
        logger.info(JSON.stringify(previewEntries, null, 2))
      }
    }
  }

  if (report.skippedFiles.length) {
    logger.warn('Skipped files:')
    for (const skipped of report.skippedFiles) {
      logger.warn(`  • ${skipped.file} (${skipped.reason})`)
    }
  }

  return report
}

export async function initCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'init'>) {
  const configModule = await loadWorkspaceConfigModule()
  await configModule.initConfig(ctx.cwd)
  const configName = configModule.CONFIG_NAME || DEFAULT_CONFIG_NAME
  logger.success(`✨ ${configName}.config.ts initialized!`)
}

export async function migrateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'migrate'>) {
  const { args } = ctx
  const normalizePatternArgs = (value?: string | string[]) => {
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

function formatFilesHint(entry: PatchStatusReport['entries'][number]) {
  if (!entry.files.length) {
    return ''
  }
  return ` (${entry.files.join(', ')})`
}

export async function statusCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'status'>) {
  const patcher = await ctx.createPatcher()
  const report = await patcher.getPatchStatus()

  if (ctx.args.json) {
    logger.log(JSON.stringify(report, null, 2))
    return report
  }

  const applied = report.entries.filter(entry => entry.status === 'applied')
  const pending = report.entries.filter(entry => entry.status === 'not-applied')
  const skipped = report.entries.filter(entry => entry.status === 'skipped' || entry.status === 'unsupported')

  const packageLabel = `${report.package.name ?? 'tailwindcss'}@${report.package.version ?? 'unknown'}`
  logger.info(`Patch status for ${packageLabel} (v${report.majorVersion})`)

  if (applied.length) {
    logger.success('Applied:')
    applied.forEach(entry => logger.success(`  • ${entry.name}${formatFilesHint(entry)}`))
  }

  if (pending.length) {
    logger.warn('Needs attention:')
    pending.forEach((entry) => {
      const details = entry.reason ? ` – ${entry.reason}` : ''
      logger.warn(`  • ${entry.name}${formatFilesHint(entry)}${details}`)
    })
  }
  else {
    logger.success('All applicable patches are applied.')
  }

  if (skipped.length) {
    logger.info('Skipped:')
    skipped.forEach((entry) => {
      const details = entry.reason ? ` – ${entry.reason}` : ''
      logger.info(`  • ${entry.name}${details}`)
    })
  }

  return report
}

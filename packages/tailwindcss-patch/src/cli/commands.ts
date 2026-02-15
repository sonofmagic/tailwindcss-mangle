import type { CAC, Command } from 'cac'
import type { LegacyTailwindcssPatcherOptions } from '../options/legacy'
import type {
  ExtractResult,
  PatchStatusReport,
  TailwindcssPatchOptions,
  TailwindTokenByFileMap,
  TailwindTokenLocation,
  TailwindTokenReport,
} from '../types'
import process from 'node:process'

import { CONFIG_NAME, getConfig, initConfig } from '@tailwindcss-mangle/config'
import { defu } from '@tailwindcss-mangle/shared'
import cac from 'cac'
import fs from 'fs-extra'
import path from 'pathe'

import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import {
  migrateConfigFiles,
  restoreConfigFiles,
  type ConfigFileMigrationReport,
  type RestoreConfigFilesResult,
} from './migrate-config'
import { groupTokensByFile } from '../extraction/candidate-extractor'
import logger from '../logger'
import { fromLegacyOptions, fromUnifiedConfig } from '../options/legacy'

export type TailwindcssPatchCommand = 'install' | 'extract' | 'tokens' | 'init' | 'migrate' | 'restore' | 'validate' | 'status'

export const tailwindcssPatchCommands: TailwindcssPatchCommand[] = ['install', 'extract', 'tokens', 'init', 'migrate', 'restore', 'validate', 'status']

export const VALIDATE_EXIT_CODES = {
  OK: 0,
  REPORT_INCOMPATIBLE: 21,
  MISSING_BACKUPS: 22,
  IO_ERROR: 23,
  UNKNOWN_ERROR: 24,
} as const

export const VALIDATE_FAILURE_REASONS = [
  'report-incompatible',
  'missing-backups',
  'io-error',
  'unknown-error',
] as const

export type ValidateFailureReason = (typeof VALIDATE_FAILURE_REASONS)[number]

export interface ValidateFailureSummary {
  reason: ValidateFailureReason
  exitCode: number
  message: string
}

export interface ValidateJsonSuccessPayload extends RestoreConfigFilesResult {
  ok: true
}

export interface ValidateJsonFailurePayload {
  ok: false
  reason: ValidateFailureReason
  exitCode: number
  message: string
}

const IO_ERROR_CODES = new Set(['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR', 'EMFILE', 'ENFILE'])

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && ('code' in error || 'message' in error)
}

function classifyValidateError(error: unknown): ValidateFailureSummary {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('Unsupported report kind') || message.startsWith('Unsupported report schema version')) {
    return {
      reason: 'report-incompatible',
      exitCode: VALIDATE_EXIT_CODES.REPORT_INCOMPATIBLE,
      message,
    }
  }
  if (message.startsWith('Restore failed:')) {
    return {
      reason: 'missing-backups',
      exitCode: VALIDATE_EXIT_CODES.MISSING_BACKUPS,
      message,
    }
  }
  if (isNodeError(error) && typeof error.code === 'string' && IO_ERROR_CODES.has(error.code)) {
    return {
      reason: 'io-error',
      exitCode: VALIDATE_EXIT_CODES.IO_ERROR,
      message,
    }
  }
  return {
    reason: 'unknown-error',
    exitCode: VALIDATE_EXIT_CODES.UNKNOWN_ERROR,
    message,
  }
}

export class ValidateCommandError extends Error {
  reason: ValidateFailureReason
  exitCode: number

  constructor(summary: ValidateFailureSummary, options?: ErrorOptions) {
    super(summary.message, options)
    this.name = 'ValidateCommandError'
    this.reason = summary.reason
    this.exitCode = summary.exitCode
  }
}

type TokenOutputFormat = 'json' | 'lines' | 'grouped-json'
type TokenGroupKey = 'relative' | 'absolute'
type CacOptionConfig = Parameters<Command['option']>[2]

export interface TailwindcssPatchCommandOptionDefinition {
  flags: string
  description?: string
  config?: CacOptionConfig
}

export interface TailwindcssPatchCommandOptions {
  name?: string
  aliases?: string[]
  description?: string
  optionDefs?: TailwindcssPatchCommandOptionDefinition[]
  appendDefaultOptions?: boolean
}

interface BaseCommandArgs {
  cwd: string
}

interface InstallCommandArgs extends BaseCommandArgs {}
interface ExtractCommandArgs extends BaseCommandArgs {
  output?: string
  format?: 'json' | 'lines'
  css?: string
  write?: boolean
}
interface TokensCommandArgs extends BaseCommandArgs {
  output?: string
  format?: TokenOutputFormat
  groupKey?: TokenGroupKey
  write?: boolean
}
interface InitCommandArgs extends BaseCommandArgs {}
interface MigrateCommandArgs extends BaseCommandArgs {
  config?: string
  dryRun?: boolean
  workspace?: boolean
  maxDepth?: string | number
  include?: string | string[]
  exclude?: string | string[]
  reportFile?: string
  backupDir?: string
  check?: boolean
  json?: boolean
}
interface RestoreCommandArgs extends BaseCommandArgs {
  reportFile?: string
  dryRun?: boolean
  strict?: boolean
  json?: boolean
}
interface ValidateCommandArgs extends BaseCommandArgs {
  reportFile?: string
  strict?: boolean
  json?: boolean
}
interface StatusCommandArgs extends BaseCommandArgs {
  json?: boolean
}

interface TailwindcssPatchCommandArgMap {
  install: InstallCommandArgs
  extract: ExtractCommandArgs
  tokens: TokensCommandArgs
  init: InitCommandArgs
  migrate: MigrateCommandArgs
  restore: RestoreCommandArgs
  validate: ValidateCommandArgs
  status: StatusCommandArgs
}

interface TailwindcssPatchCommandResultMap {
  install: void
  extract: ExtractResult
  tokens: TailwindTokenReport
  init: void
  migrate: ConfigFileMigrationReport
  restore: RestoreConfigFilesResult
  validate: RestoreConfigFilesResult
  status: PatchStatusReport
}

export interface TailwindcssPatchCommandContext<TCommand extends TailwindcssPatchCommand> {
  cli: CAC
  command: Command
  commandName: TCommand
  args: TailwindcssPatchCommandArgMap[TCommand]
  cwd: string
  logger: typeof logger
  loadConfig: () => ReturnType<typeof getConfig>
  loadPatchOptions: (overrides?: TailwindcssPatchOptions) => Promise<TailwindcssPatchOptions>
  createPatcher: (overrides?: TailwindcssPatchOptions) => Promise<TailwindcssPatcher>
}

export type TailwindcssPatchCommandHandler<TCommand extends TailwindcssPatchCommand> = (
  context: TailwindcssPatchCommandContext<TCommand>,
  next: () => Promise<TailwindcssPatchCommandResultMap[TCommand]>,
) => Promise<TailwindcssPatchCommandResultMap[TCommand]> | TailwindcssPatchCommandResultMap[TCommand]

export type TailwindcssPatchCommandHandlerMap = Partial<{
  [K in TailwindcssPatchCommand]: TailwindcssPatchCommandHandler<K>
}>

export interface TailwindcssPatchCliMountOptions {
  commandPrefix?: string
  commands?: TailwindcssPatchCommand[]
  commandOptions?: Partial<Record<TailwindcssPatchCommand, TailwindcssPatchCommandOptions>>
  commandHandlers?: TailwindcssPatchCommandHandlerMap
}

export interface TailwindcssPatchCliOptions {
  name?: string
  mountOptions?: TailwindcssPatchCliMountOptions
}

interface TailwindcssPatchCommandDefinition {
  description: string
  optionDefs: TailwindcssPatchCommandOptionDefinition[]
}

const TOKEN_FORMATS: TokenOutputFormat[] = ['json', 'lines', 'grouped-json']
const DEFAULT_TOKEN_REPORT = '.tw-patch/tw-token-report.json'

function formatTokenLine(entry: TailwindTokenLocation) {
  return `${entry.relativeFile}:${entry.line}:${entry.column} ${entry.rawCandidate} (${entry.start}-${entry.end})`
}

function formatGroupedPreview(map: TailwindTokenByFileMap, limit: number = 3) {
  const files = Object.keys(map)
  if (!files.length) {
    return { preview: '', moreFiles: 0 }
  }

  const lines = files.slice(0, limit).map((file) => {
    const tokens = map[file] ?? []
    const sample = tokens.slice(0, 3).map(token => token.rawCandidate).join(', ')
    const suffix = tokens.length > 3 ? ', …' : ''
    return `${file}: ${tokens.length} tokens (${sample}${suffix})`
  })

  return {
    preview: lines.join('\n'),
    moreFiles: Math.max(0, files.length - limit),
  }
}

function resolveCwd(rawCwd?: string) {
  if (!rawCwd) {
    return process.cwd()
  }
  return path.resolve(rawCwd)
}

function createDefaultRunner<TResult>(factory: () => Promise<TResult>) {
  let promise: Promise<TResult> | undefined
  return () => {
    if (!promise) {
      promise = factory()
    }
    return promise
  }
}

async function loadPatchOptionsForCwd(cwd: string, overrides?: TailwindcssPatchOptions) {
  const { config } = await getConfig(cwd)
  const legacyConfig = config as (typeof config) & { patch?: LegacyTailwindcssPatcherOptions['patch'] }
  const base = config?.registry
    ? fromUnifiedConfig(config.registry)
    : legacyConfig?.patch
      ? fromLegacyOptions({ patch: legacyConfig.patch })
      : {}
  const merged = defu<TailwindcssPatchOptions, TailwindcssPatchOptions[]>(overrides ?? {}, base)
  return merged
}

function createCommandContext<TCommand extends TailwindcssPatchCommand>(
  cli: CAC,
  command: Command,
  commandName: TCommand,
  args: TailwindcssPatchCommandArgMap[TCommand],
  cwd: string,
): TailwindcssPatchCommandContext<TCommand> {
  let cachedOptions: Promise<TailwindcssPatchOptions> | undefined
  let cachedPatcher: Promise<TailwindcssPatcher> | undefined
  let cachedConfig: ReturnType<typeof getConfig> | undefined

  const loadPatchOptionsForContext = (overrides?: TailwindcssPatchOptions) => {
    if (overrides) {
      return loadPatchOptionsForCwd(cwd, overrides)
    }
    if (!cachedOptions) {
      cachedOptions = loadPatchOptionsForCwd(cwd)
    }
    return cachedOptions
  }

  const createPatcherForContext = async (overrides?: TailwindcssPatchOptions) => {
    if (overrides) {
      const patchOptions = await loadPatchOptionsForCwd(cwd, overrides)
      return new TailwindcssPatcher(patchOptions)
    }
    if (!cachedPatcher) {
      cachedPatcher = loadPatchOptionsForContext().then(options => new TailwindcssPatcher(options))
    }
    return cachedPatcher
  }

  return {
    cli,
    command,
    commandName,
    args,
    cwd,
    logger,
    loadConfig: () => {
      if (!cachedConfig) {
        cachedConfig = getConfig(cwd)
      }
      return cachedConfig
    },
    loadPatchOptions: loadPatchOptionsForContext,
    createPatcher: createPatcherForContext,
  }
}

function createCwdOptionDefinition(description: string = 'Working directory'): TailwindcssPatchCommandOptionDefinition {
  return {
    flags: '--cwd <dir>',
    description,
    config: { default: process.cwd() },
  }
}

function buildDefaultCommandDefinitions(): Record<TailwindcssPatchCommand, TailwindcssPatchCommandDefinition> {
  return {
    install: {
      description: 'Apply Tailwind CSS runtime patches',
      optionDefs: [createCwdOptionDefinition()],
    },
    extract: {
      description: 'Collect generated class names into a cache file',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--output <file>', description: 'Override output file path' },
        { flags: '--format <format>', description: 'Output format (json|lines)' },
        { flags: '--css <file>', description: 'Tailwind CSS entry CSS when using v4' },
        { flags: '--no-write', description: 'Skip writing to disk' },
      ],
    },
    tokens: {
      description: 'Extract Tailwind tokens with file/position metadata',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--output <file>', description: 'Override output file path', config: { default: DEFAULT_TOKEN_REPORT } },
        {
          flags: '--format <format>',
          description: 'Output format (json|lines|grouped-json)',
          config: { default: 'json' },
        },
        {
          flags: '--group-key <key>',
          description: 'Grouping key for grouped-json output (relative|absolute)',
          config: { default: 'relative' },
        },
        { flags: '--no-write', description: 'Skip writing to disk' },
      ],
    },
    init: {
      description: 'Generate a tailwindcss-patch config file',
      optionDefs: [createCwdOptionDefinition()],
    },
    migrate: {
      description: 'Migrate deprecated config fields to modern options',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--config <file>', description: 'Migrate a specific config file path' },
        { flags: '--workspace', description: 'Scan workspace recursively for config files' },
        { flags: '--max-depth <n>', description: 'Maximum recursion depth for --workspace', config: { default: 6 } },
        { flags: '--include <glob>', description: 'Only migrate files that match this glob (repeatable)' },
        { flags: '--exclude <glob>', description: 'Skip files that match this glob (repeatable)' },
        { flags: '--report-file <file>', description: 'Write migration report JSON to a file' },
        { flags: '--backup-dir <dir>', description: 'Write pre-migration backups into this directory' },
        { flags: '--check', description: 'Exit with an error when migration changes are required' },
        { flags: '--json', description: 'Print the migration report as JSON' },
        { flags: '--dry-run', description: 'Preview changes without writing files' },
      ],
    },
    restore: {
      description: 'Restore config files from a previous migration report backup snapshot',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--report-file <file>', description: 'Migration report file generated by migrate' },
        { flags: '--dry-run', description: 'Preview restore targets without writing files' },
        { flags: '--strict', description: 'Fail when any backup file is missing' },
        { flags: '--json', description: 'Print the restore result as JSON' },
      ],
    },
    validate: {
      description: 'Validate migration report compatibility without modifying files',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--report-file <file>', description: 'Migration report file to validate' },
        { flags: '--strict', description: 'Fail when any backup file is missing' },
        { flags: '--json', description: 'Print validation result as JSON' },
      ],
    },
    status: {
      description: 'Check which Tailwind patches are applied',
      optionDefs: [
        createCwdOptionDefinition(),
        { flags: '--json', description: 'Print a JSON report of patch status' },
      ],
    },
  }
}

function addPrefixIfMissing(value: string, prefix: string) {
  if (!prefix || value.startsWith(prefix)) {
    return value
  }
  return `${prefix}${value}`
}

function resolveCommandNames(
  command: TailwindcssPatchCommand,
  mountOptions: TailwindcssPatchCliMountOptions,
  prefix: string,
) {
  const override = mountOptions.commandOptions?.[command]
  const baseName = override?.name ?? command
  const name = addPrefixIfMissing(baseName, prefix)
  const aliases = (override?.aliases ?? []).map(alias => addPrefixIfMissing(alias, prefix))
  return { name, aliases }
}

function resolveOptionDefinitions(
  defaults: TailwindcssPatchCommandOptionDefinition[],
  override?: TailwindcssPatchCommandOptions,
) {
  if (!override) {
    return defaults
  }

  const appendDefaults = override.appendDefaultOptions ?? true
  const customDefs = override.optionDefs ?? []
  if (!appendDefaults) {
    return customDefs
  }

  if (customDefs.length === 0) {
    return defaults
  }

  return [...defaults, ...customDefs]
}

function applyCommandOptions(command: Command, optionDefs: TailwindcssPatchCommandOptionDefinition[]) {
  for (const option of optionDefs) {
    command.option(option.flags, option.description ?? '', option.config)
  }
}

function runWithCommandHandler<TCommand extends TailwindcssPatchCommand>(
  cli: CAC,
  command: Command,
  commandName: TCommand,
  args: TailwindcssPatchCommandArgMap[TCommand],
  handler: TailwindcssPatchCommandHandler<TCommand> | undefined,
  defaultHandler: (
    context: TailwindcssPatchCommandContext<TCommand>,
  ) => Promise<TailwindcssPatchCommandResultMap[TCommand]>,
) {
  const cwd = resolveCwd(args.cwd)
  const context = createCommandContext(cli, command, commandName, args, cwd)
  const runDefault = createDefaultRunner(() => defaultHandler(context))
  if (!handler) {
    return runDefault()
  }
  return handler(context, runDefault)
}

function resolveCommandMetadata(
  command: TailwindcssPatchCommand,
  mountOptions: TailwindcssPatchCliMountOptions,
  prefix: string,
  defaults: Record<TailwindcssPatchCommand, TailwindcssPatchCommandDefinition>,
) {
  const names = resolveCommandNames(command, mountOptions, prefix)
  const definition = defaults[command]
  const override = mountOptions.commandOptions?.[command]
  const description = override?.description ?? definition.description
  const optionDefs = resolveOptionDefinitions(definition.optionDefs, override)
  return { ...names, description, optionDefs }
}

async function installCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'install'>) {
  const patcher = await ctx.createPatcher()
  await patcher.patch()
  logger.success('Tailwind CSS runtime patched successfully.')
}

async function extractCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'extract'>) {
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

async function tokensCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'tokens'>) {
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

async function initCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'init'>) {
  await initConfig(ctx.cwd)
  logger.success(`✨ ${CONFIG_NAME}.config.ts initialized!`)
}

async function migrateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'migrate'>) {
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

async function restoreCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'restore'>) {
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

async function validateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'validate'>) {
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

async function statusCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'status'>) {
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

export function mountTailwindcssPatchCommands(cli: CAC, options: TailwindcssPatchCliMountOptions = {}) {
  const prefix = options.commandPrefix ?? ''
  const selectedCommands = options.commands ?? tailwindcssPatchCommands
  const defaultDefinitions = buildDefaultCommandDefinitions()

  const registrars: Record<TailwindcssPatchCommand, () => void> = {
    install: () => {
      const metadata = resolveCommandMetadata('install', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: InstallCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'install',
          args,
          options.commandHandlers?.install,
          installCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    extract: () => {
      const metadata = resolveCommandMetadata('extract', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: ExtractCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'extract',
          args,
          options.commandHandlers?.extract,
          extractCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    tokens: () => {
      const metadata = resolveCommandMetadata('tokens', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: TokensCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'tokens',
          args,
          options.commandHandlers?.tokens,
          tokensCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    init: () => {
      const metadata = resolveCommandMetadata('init', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: InitCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'init',
          args,
          options.commandHandlers?.init,
          initCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    migrate: () => {
      const metadata = resolveCommandMetadata('migrate', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: MigrateCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'migrate',
          args,
          options.commandHandlers?.migrate,
          migrateCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    restore: () => {
      const metadata = resolveCommandMetadata('restore', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: RestoreCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'restore',
          args,
          options.commandHandlers?.restore,
          restoreCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    validate: () => {
      const metadata = resolveCommandMetadata('validate', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: ValidateCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'validate',
          args,
          options.commandHandlers?.validate,
          validateCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
    status: () => {
      const metadata = resolveCommandMetadata('status', options, prefix, defaultDefinitions)
      const command = cli.command(metadata.name, metadata.description)
      applyCommandOptions(command, metadata.optionDefs)
      command.action(async (args: StatusCommandArgs) => {
        return runWithCommandHandler(
          cli,
          command,
          'status',
          args,
          options.commandHandlers?.status,
          statusCommandDefaultHandler,
        )
      })
      metadata.aliases.forEach(alias => command.alias(alias))
    },
  }

  for (const name of selectedCommands) {
    const register = registrars[name]
    if (register) {
      register()
    }
  }

  return cli
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  const cli = cac(options.name ?? 'tw-patch')
  mountTailwindcssPatchCommands(cli, options.mountOptions)
  return cli
}

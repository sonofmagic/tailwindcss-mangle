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
import { groupTokensByFile } from '../extraction/candidate-extractor'
import logger from '../logger'
import { fromLegacyOptions, fromUnifiedConfig } from '../options/legacy'

export type TailwindcssPatchCommand = 'install' | 'extract' | 'tokens' | 'init' | 'status'

export const tailwindcssPatchCommands: TailwindcssPatchCommand[] = ['install', 'extract', 'tokens', 'init', 'status']

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
interface StatusCommandArgs extends BaseCommandArgs {
  json?: boolean
}

interface TailwindcssPatchCommandArgMap {
  install: InstallCommandArgs
  extract: ExtractCommandArgs
  tokens: TokensCommandArgs
  init: InitCommandArgs
  status: StatusCommandArgs
}

interface TailwindcssPatchCommandResultMap {
  install: void
  extract: ExtractResult
  tokens: TailwindTokenReport
  init: void
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
    const tokens = map[file]
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
    overrides.output = {
      file: args.output,
      format: args.format,
    }
    hasOverrides = true
  }

  if (args.css) {
    overrides.tailwind = {
      v4: {
        cssEntries: [args.css],
      },
    }
    hasOverrides = true
  }

  const patcher = await ctx.createPatcher(hasOverrides ? overrides : undefined)
  const result = await patcher.extract({ write: args.write })

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

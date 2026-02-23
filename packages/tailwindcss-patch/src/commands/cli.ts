import type { CAC, Command } from 'cac'
import type { TailwindcssConfigResult } from '../config/workspace'
import type {
  ExtractResult,
  PatchStatusReport,
  TailwindcssPatchOptions,
  TailwindTokenReport,
} from '../types'
import type { ConfigFileMigrationReport, RestoreConfigFilesResult } from './migrate-config'
import type {
  TokenGroupKey,
  TokenOutputFormat,
} from './token-output'

import process from 'node:process'
import cac from 'cac'

import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadPatchOptionsForWorkspace, loadWorkspaceConfigModule } from '../config/workspace'
import logger from '../logger'
import { DEFAULT_TOKEN_REPORT } from './token-output'
import {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
} from './validate'
import {
  extractCommandDefaultHandler,
  initCommandDefaultHandler,
  installCommandDefaultHandler,
  migrateCommandDefaultHandler,
  restoreCommandDefaultHandler,
  statusCommandDefaultHandler,
  tokensCommandDefaultHandler,
  validateCommandDefaultHandler,
} from './default-handlers'

export type TailwindcssPatchCommand = 'install' | 'extract' | 'tokens' | 'init' | 'migrate' | 'restore' | 'validate' | 'status'

export const tailwindcssPatchCommands: TailwindcssPatchCommand[] = ['install', 'extract', 'tokens', 'init', 'migrate', 'restore', 'validate', 'status']
export {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
}
export type {
  ValidateFailureReason,
  ValidateFailureSummary,
  ValidateJsonFailurePayload,
  ValidateJsonSuccessPayload,
} from './validate'

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
  loadConfig: () => Promise<TailwindcssConfigResult>
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
  return loadPatchOptionsForWorkspace(cwd, overrides)
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
  let cachedConfig: Promise<TailwindcssConfigResult> | undefined

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
        cachedConfig = loadWorkspaceConfigModule().then(mod => mod.getConfig(cwd))
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

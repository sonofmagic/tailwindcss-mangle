import type { CAC, Command } from 'cac'
import type { TailwindcssConfigResult } from '../config/workspace'
import type logger from '../logger'
import type {
  ExtractResult,
  PatchStatusReport,
  TailwindcssPatchOptions,
  TailwindTokenReport,
} from '../types'
import type { ConfigFileMigrationReport, RestoreConfigFilesResult } from './migrate-config'
import type { TokenGroupKey, TokenOutputFormat } from './token-output'

export type TailwindcssPatchCommand = 'install' | 'extract' | 'tokens' | 'init' | 'migrate' | 'restore' | 'validate' | 'status'

export const tailwindcssPatchCommands: TailwindcssPatchCommand[] = ['install', 'extract', 'tokens', 'init', 'migrate', 'restore', 'validate', 'status']

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

export interface TailwindcssPatchCommandArgMap {
  install: InstallCommandArgs
  extract: ExtractCommandArgs
  tokens: TokensCommandArgs
  init: InitCommandArgs
  migrate: MigrateCommandArgs
  restore: RestoreCommandArgs
  validate: ValidateCommandArgs
  status: StatusCommandArgs
}

export interface TailwindcssPatchCommandResultMap {
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
  createPatcher: (overrides?: TailwindcssPatchOptions) => Promise<import('../api/tailwindcss-patcher').TailwindcssPatcher>
}

export type TailwindcssPatchCommandDefaultHandlerMap = {
  [K in TailwindcssPatchCommand]: (
    context: TailwindcssPatchCommandContext<K>,
  ) => Promise<TailwindcssPatchCommandResultMap[K]>
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

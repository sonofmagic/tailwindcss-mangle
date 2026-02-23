import type { CAC, Command } from 'cac'
import type { TailwindcssConfigResult } from '../config/workspace'
import type { TailwindcssPatchOptions } from '../types'
import type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCliOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandResultMap,
} from './types'

import process from 'node:process'
import cac from 'cac'
import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadPatchOptionsForWorkspace, loadWorkspaceConfigModule } from '../config/workspace'
import logger from '../logger'
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
import {
  applyCommandOptions,
  buildDefaultCommandDefinitions,
  resolveCommandMetadata,
} from './metadata'
import { tailwindcssPatchCommands } from './types'

export {
  tailwindcssPatchCommands,
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
}
export type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCliOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandHandlerMap,
  TailwindcssPatchCommandOptionDefinition,
  TailwindcssPatchCommandOptions,
} from './types'
export type {
  ValidateFailureReason,
  ValidateFailureSummary,
  ValidateJsonFailurePayload,
  ValidateJsonSuccessPayload,
} from './validate'

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

export function mountTailwindcssPatchCommands(cli: CAC, options: TailwindcssPatchCliMountOptions = {}) {
  const prefix = options.commandPrefix ?? ''
  const selectedCommands = options.commands ?? tailwindcssPatchCommands
  const defaultDefinitions = buildDefaultCommandDefinitions()

  const defaultHandlers: {
    [K in TailwindcssPatchCommand]: (
      context: TailwindcssPatchCommandContext<K>,
    ) => Promise<TailwindcssPatchCommandResultMap[K]>
  } = {
    install: installCommandDefaultHandler,
    extract: extractCommandDefaultHandler,
    tokens: tokensCommandDefaultHandler,
    init: initCommandDefaultHandler,
    migrate: migrateCommandDefaultHandler,
    restore: restoreCommandDefaultHandler,
    validate: validateCommandDefaultHandler,
    status: statusCommandDefaultHandler,
  }

  const registerCommand = <TCommand extends TailwindcssPatchCommand>(commandName: TCommand) => {
    const metadata = resolveCommandMetadata(commandName, options, prefix, defaultDefinitions)
    const command = cli.command(metadata.name, metadata.description)
    applyCommandOptions(command, metadata.optionDefs)
    command.action(async (args: TailwindcssPatchCommandArgMap[TCommand]) => {
      return runWithCommandHandler(
        cli,
        command,
        commandName,
        args,
        options.commandHandlers?.[commandName] as TailwindcssPatchCommandHandler<TCommand> | undefined,
        defaultHandlers[commandName],
      )
    })
    metadata.aliases.forEach(alias => command.alias(alias))
  }

  for (const name of selectedCommands) {
    registerCommand(name)
  }

  return cli
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  const cli = cac(options.name ?? 'tw-patch')
  mountTailwindcssPatchCommands(cli, options.mountOptions)
  return cli
}

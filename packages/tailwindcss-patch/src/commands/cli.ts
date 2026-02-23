import type { CAC } from 'cac'
import type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCliOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandResultMap,
} from './types'

import cac from 'cac'
import {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
} from './validate'
import {
  extractCommandDefaultHandler,
  initCommandDefaultHandler,
  installCommandDefaultHandler,
  tokensCommandDefaultHandler,
} from './basic-handlers'
import {
  migrateCommandDefaultHandler,
  restoreCommandDefaultHandler,
  validateCommandDefaultHandler,
} from './migration-handlers'
import { statusCommandDefaultHandler } from './status-handler'
import {
  applyCommandOptions,
  buildDefaultCommandDefinitions,
  resolveCommandMetadata,
} from './metadata'
import { runWithCommandHandler } from './command-runtime'
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

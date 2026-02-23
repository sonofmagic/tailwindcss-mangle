import type { CAC } from 'cac'
import type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCliOptions,
  TailwindcssPatchCommandContext,
} from './types'

import cac from 'cac'
import {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
} from './validate'
import { buildDefaultCommandDefinitions } from './metadata'
import { registerTailwindcssPatchCommand } from './command-registrar'
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

  for (const name of selectedCommands) {
    registerTailwindcssPatchCommand(cli, name, options, prefix, defaultDefinitions)
  }

  return cli
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  const cli = cac(options.name ?? 'tw-patch')
  mountTailwindcssPatchCommands(cli, options.mountOptions)
  return cli
}

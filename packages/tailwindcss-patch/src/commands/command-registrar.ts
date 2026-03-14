import type { CAC } from 'cac'
import type { TailwindcssPatchCommandDefinitions } from './command-definitions'
import type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandDefaultHandlerMap,
} from './types'

import {
  applyCommandOptions,
  resolveCommandMetadata,
} from './command-metadata'
import { runWithCommandHandler } from './command-runtime'
import { defaultCommandHandlers } from './default-handler-map'

export function registerTailwindcssPatchCommand<TCommand extends TailwindcssPatchCommand>(
  cli: CAC,
  commandName: TCommand,
  options: TailwindcssPatchCliMountOptions,
  prefix: string,
  defaultDefinitions: TailwindcssPatchCommandDefinitions,
) {
  const metadata = resolveCommandMetadata(commandName, options, prefix, defaultDefinitions)
  const command = cli.command(metadata.name, metadata.description)
  applyCommandOptions(command, metadata.optionDefs)
  command.action(async (args: TailwindcssPatchCommandArgMap[TCommand]) => {
    const defaultHandler = defaultCommandHandlers[commandName] as TailwindcssPatchCommandDefaultHandlerMap[TCommand]
    return runWithCommandHandler(
      cli,
      command,
      commandName,
      args,
      options.commandHandlers?.[commandName],
      defaultHandler,
    )
  })
  metadata.aliases.forEach(alias => command.alias(alias))
}

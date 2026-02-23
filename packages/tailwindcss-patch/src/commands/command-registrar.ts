import type { CAC } from 'cac'
import type { TailwindcssPatchCliMountOptions, TailwindcssPatchCommand, TailwindcssPatchCommandArgMap } from './types'
import type { TailwindcssPatchCommandDefinitions } from './command-definitions'

import { runWithCommandHandler } from './command-runtime'
import { defaultCommandHandlers } from './default-handler-map'
import {
  applyCommandOptions,
  resolveCommandMetadata,
} from './command-metadata'

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
    return runWithCommandHandler(
      cli,
      command,
      commandName,
      args,
      options.commandHandlers?.[commandName],
      defaultCommandHandlers[commandName],
    )
  })
  metadata.aliases.forEach(alias => command.alias(alias))
}

import type { CAC, Command } from 'cac'
import type {
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandResultMap,
} from './types'

import {
  createMemoizedPromiseRunner,
  createTailwindcssPatchCommandContext,
  resolveCommandCwd,
} from './command-context'

export function runWithCommandHandler<TCommand extends TailwindcssPatchCommand>(
  cli: CAC,
  command: Command,
  commandName: TCommand,
  args: TailwindcssPatchCommandArgMap[TCommand],
  handler: TailwindcssPatchCommandHandler<TCommand> | undefined,
  defaultHandler: (
    context: TailwindcssPatchCommandContext<TCommand>,
  ) => Promise<TailwindcssPatchCommandResultMap[TCommand]>,
) {
  const cwd = resolveCommandCwd(args.cwd)
  const context = createTailwindcssPatchCommandContext(cli, command, commandName, args, cwd)
  const runDefault = createMemoizedPromiseRunner(() => defaultHandler(context))
  if (!handler) {
    return runDefault()
  }
  return handler(context, runDefault)
}

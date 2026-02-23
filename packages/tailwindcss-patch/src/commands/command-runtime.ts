import type { CAC, Command } from 'cac'
import type { TailwindcssConfigResult } from '../config/workspace'
import type { TailwindcssPatchOptions } from '../types'
import type {
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandResultMap,
} from './types'

import process from 'node:process'
import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadPatchOptionsForWorkspace, loadWorkspaceConfigModule } from '../config/workspace'
import logger from '../logger'

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
  const cwd = resolveCwd(args.cwd)
  const context = createCommandContext(cli, command, commandName, args, cwd)
  const runDefault = createDefaultRunner(() => defaultHandler(context))
  if (!handler) {
    return runDefault()
  }
  return handler(context, runDefault)
}

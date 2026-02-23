import type { CAC, Command } from 'cac'
import type { TailwindcssConfigResult } from '../config/workspace'
import type { TailwindcssPatchOptions } from '../types'
import type {
  TailwindcssPatchCommand,
  TailwindcssPatchCommandArgMap,
  TailwindcssPatchCommandContext,
} from './types'

import process from 'node:process'
import path from 'pathe'
import { TailwindcssPatcher } from '../api/tailwindcss-patcher'
import { loadPatchOptionsForWorkspace, loadWorkspaceConfigModule } from '../config/workspace'
import logger from '../logger'

export function resolveCommandCwd(rawCwd?: string) {
  if (!rawCwd) {
    return process.cwd()
  }
  return path.resolve(rawCwd)
}

export function createMemoizedPromiseRunner<TResult>(factory: () => Promise<TResult>) {
  let promise: Promise<TResult> | undefined
  return () => {
    if (!promise) {
      promise = factory()
    }
    return promise
  }
}

export function createTailwindcssPatchCommandContext<TCommand extends TailwindcssPatchCommand>(
  cli: CAC,
  command: Command,
  commandName: TCommand,
  args: TailwindcssPatchCommandArgMap[TCommand],
  cwd: string,
): TailwindcssPatchCommandContext<TCommand> {
  const loadCachedConfig = createMemoizedPromiseRunner<TailwindcssConfigResult>(() =>
    loadWorkspaceConfigModule().then(mod => mod.getConfig(cwd)),
  )
  const loadCachedPatchOptions = createMemoizedPromiseRunner<TailwindcssPatchOptions>(() =>
    loadPatchOptionsForWorkspace(cwd),
  )
  const createCachedPatcher = createMemoizedPromiseRunner<TailwindcssPatcher>(async () => {
    const patchOptions = await loadCachedPatchOptions()
    return new TailwindcssPatcher(patchOptions)
  })

  const loadPatchOptionsForContext = (overrides?: TailwindcssPatchOptions) => {
    if (overrides) {
      return loadPatchOptionsForWorkspace(cwd, overrides)
    }
    return loadCachedPatchOptions()
  }

  const createPatcherForContext = async (overrides?: TailwindcssPatchOptions) => {
    if (overrides) {
      const patchOptions = await loadPatchOptionsForWorkspace(cwd, overrides)
      return new TailwindcssPatcher(patchOptions)
    }
    return createCachedPatcher()
  }

  return {
    cli,
    command,
    commandName,
    args,
    cwd,
    logger,
    loadConfig: loadCachedConfig,
    loadPatchOptions: loadPatchOptionsForContext,
    createPatcher: createPatcherForContext,
  }
}

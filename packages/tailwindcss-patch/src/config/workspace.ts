import type { LegacyTailwindcssPatcherOptions } from '../options/legacy'
import type { TailwindcssPatchOptions } from '../types'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { fromLegacyOptions, fromUnifiedConfig } from '../options/legacy'

export interface TailwindcssConfigModule {
  CONFIG_NAME: string
  getConfig: (cwd?: string) => Promise<{ config?: { registry?: unknown, patch?: LegacyTailwindcssPatcherOptions['patch'] } }>
  initConfig: (cwd: string) => Promise<unknown>
}

export type TailwindcssConfigResult = Awaited<ReturnType<TailwindcssConfigModule['getConfig']>>
type DefuFn = (...objects: unknown[]) => unknown

let configModulePromise: Promise<TailwindcssConfigModule> | undefined
let defuPromise: Promise<DefuFn> | undefined

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && ('code' in error || 'message' in error)
}

function isMissingConfigModuleError(error: unknown) {
  if (!isNodeError(error) || error.code !== 'MODULE_NOT_FOUND') {
    return false
  }
  const message = error.message ?? ''
  return message.includes('@tailwindcss-mangle/config')
}

function isMissingSharedModuleError(error: unknown) {
  if (!isNodeError(error) || error.code !== 'MODULE_NOT_FOUND') {
    return false
  }
  const message = error.message ?? ''
  return message.includes('@tailwindcss-mangle/shared')
}

export async function loadWorkspaceConfigModule() {
  if (!configModulePromise) {
    configModulePromise = (import('@tailwindcss-mangle/config') as Promise<TailwindcssConfigModule>)
      .catch(async (error) => {
        if (!isMissingConfigModuleError(error)) {
          throw error
        }
        const fallback = path.resolve(__dirname, '../../../config/src/index.ts')
        return import(pathToFileURL(fallback).href) as Promise<TailwindcssConfigModule>
      })
  }
  return configModulePromise
}

export async function loadWorkspaceDefu() {
  if (!defuPromise) {
    defuPromise = (import('@tailwindcss-mangle/shared') as Promise<{ defu: DefuFn }>)
      .then(mod => mod.defu)
      .catch(async (error) => {
        if (!isMissingSharedModuleError(error)) {
          throw error
        }
        const fallback = path.resolve(__dirname, '../../../shared/src/utils.ts')
        const mod = await import(pathToFileURL(fallback).href) as { defu: DefuFn }
        return mod.defu
      })
  }
  return defuPromise
}

export async function loadPatchOptionsForWorkspace(cwd: string, overrides?: TailwindcssPatchOptions) {
  const merge = await loadWorkspaceDefu()
  const configModule = await loadWorkspaceConfigModule()
  const { config } = await configModule.getConfig(cwd)
  const legacyConfig = config as (typeof config) & { patch?: LegacyTailwindcssPatcherOptions['patch'] }
  const base = config?.registry
    ? fromUnifiedConfig(config.registry)
    : legacyConfig?.patch
      ? fromLegacyOptions({ patch: legacyConfig.patch })
      : {}
  const merged = merge(overrides ?? {}, base) as TailwindcssPatchOptions
  return merged
}

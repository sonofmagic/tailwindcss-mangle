import type { TailwindCssPatchOptions } from '../types'
import { pathToFileURL } from 'node:url'
import path from 'pathe'
import { fromUnifiedConfig } from '../options/legacy'

export interface TailwindcssConfigModule {
  CONFIG_NAME: string
  getConfig: (cwd?: string) => Promise<{ config?: { registry?: unknown, patch?: unknown } }>
  initConfig: (cwd: string) => Promise<unknown>
}

export type TailwindcssConfigResult = Awaited<ReturnType<TailwindcssConfigModule['getConfig']>>
type DefuFn = (...objects: unknown[]) => unknown

let configModulePromise: Promise<TailwindcssConfigModule> | undefined
let defuPromise: Promise<DefuFn> | undefined

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && ('code' in error || 'message' in error)
}

export function isMissingModuleError(error: unknown, pkgName: string) {
  if (!isNodeError(error)) {
    return false
  }

  const code = error.code
  if (code !== 'MODULE_NOT_FOUND' && code !== 'ERR_MODULE_NOT_FOUND') {
    return false
  }

  const message = error.message ?? ''
  return message.includes(pkgName) || message.includes(`${pkgName}/dist/`)
}

function isMissingConfigModuleError(error: unknown) {
  return isMissingModuleError(error, '@tailwindcss-mangle/config')
}

function isMissingSharedModuleError(error: unknown) {
  return isMissingModuleError(error, '@tailwindcss-mangle/shared')
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

export async function loadPatchOptionsForWorkspace(cwd: string, overrides?: TailwindCssPatchOptions) {
  const merge = await loadWorkspaceDefu()
  const configModule = await loadWorkspaceConfigModule()
  const { config } = await configModule.getConfig(cwd)
  if (config && typeof config === 'object' && 'patch' in config && config.patch !== undefined) {
    throw new Error('Legacy workspace config field "patch" is no longer supported. Move patcher options under "registry".')
  }

  const base = config?.registry
    ? fromUnifiedConfig(config.registry)
    : {}
  const merged = merge(overrides ?? {}, base) as TailwindCssPatchOptions
  return merged
}

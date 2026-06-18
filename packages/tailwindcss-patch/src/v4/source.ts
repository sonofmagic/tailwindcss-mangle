import type { TailwindV4ResolvedSource, TailwindV4SourceOptions } from '@tailwindcss-mangle/engine/v4/types'
import type { NormalizedTailwindCssPatchOptions, TailwindCssPatchOptions } from '../config'
import { resolveTailwindV4Source } from '@tailwindcss-mangle/engine/v4/source'
import path from 'pathe'
import { normalizeOptions } from '../config'

function uniquePaths(values: Iterable<string | undefined>) {
  const result: string[] = []
  for (const value of values) {
    if (!value) {
      continue
    }
    const resolved = path.resolve(value)
    if (!result.includes(resolved)) {
      result.push(resolved)
    }
  }
  return result
}

function resolveConfigDir(config: string | undefined, projectRoot: string) {
  if (!config) {
    return undefined
  }
  const configPath = path.isAbsolute(config) ? config : path.resolve(projectRoot, config)
  return path.dirname(configPath)
}

function createSourceOptionsFromNormalizedPatchOptions(
  options: NormalizedTailwindCssPatchOptions,
): TailwindV4SourceOptions {
  const v4 = options.tailwind.v4
  const configDir = resolveConfigDir(options.tailwind.config, options.projectRoot)
  const baseFallbacks = uniquePaths([
    v4?.configuredBase,
    options.tailwind.cwd,
    options.projectRoot,
    configDir,
  ])

  return {
    projectRoot: options.projectRoot,
    ...(options.tailwind.cwd === undefined ? {} : { cwd: options.tailwind.cwd }),
    ...(v4?.configuredBase === undefined ? {} : { base: v4.configuredBase }),
    baseFallbacks,
    ...(v4?.css === undefined ? {} : { css: v4.css }),
    ...(v4?.cssSources === undefined ? {} : { cssSources: v4.cssSources }),
    ...(v4?.cssEntries === undefined ? {} : { cssEntries: v4.cssEntries }),
    packageName: options.tailwind.packageName,
  }
}

export { resolveTailwindV4Source }

export function tailwindV4SourceOptionsFromPatchOptions(options: TailwindCssPatchOptions): TailwindV4SourceOptions {
  return createSourceOptionsFromNormalizedPatchOptions(normalizeOptions(options))
}

export async function resolveTailwindV4SourceFromPatchOptions(
  options: TailwindCssPatchOptions,
): Promise<TailwindV4ResolvedSource> {
  return resolveTailwindV4Source(tailwindV4SourceOptionsFromPatchOptions(options))
}

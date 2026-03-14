import { createRequire } from 'node:module'
import fs from 'fs-extra'
import path from 'pathe'
import postcss from 'postcss'
import { loadConfig } from 'tailwindcss-config'

const require = createRequire(import.meta.url)

export interface TailwindBuildOptions {
  cwd: string
  config?: string
  majorVersion: 2 | 3 | 4
  postcssPlugin?: string
}

function resolveModuleEntry(id: string) {
  return path.isAbsolute(id) ? id : require.resolve(id)
}

function resolvePackageRootFromEntry(entry: string) {
  let current = path.dirname(entry)
  while (current && current !== path.dirname(current)) {
    const packageJsonPath = path.join(current, 'package.json')
    if (fs.pathExistsSync(packageJsonPath)) {
      return current
    }
    current = path.dirname(current)
  }
  return undefined
}

function clearTailwindV3RuntimeState(pluginName: string) {
  try {
    const entry = resolveModuleEntry(pluginName)
    const root = resolvePackageRootFromEntry(entry)
    if (!root) {
      return
    }

    const sharedStatePath = path.join(root, 'lib/lib/sharedState.js')
    if (!fs.pathExistsSync(sharedStatePath)) {
      return
    }

    const sharedState = require.cache[sharedStatePath]?.exports as
      | {
      contextMap?: Map<unknown, unknown>
      configContextMap?: Map<unknown, unknown>
      contextSourcesMap?: Map<unknown, unknown>
      sourceHashMap?: Map<unknown, unknown>
    }
      | undefined
    sharedState?.contextMap?.clear()
    sharedState?.configContextMap?.clear()
    sharedState?.contextSourcesMap?.clear()
    sharedState?.sourceHashMap?.clear()

    for (const candidate of ['lib/plugin.js', 'lib/index.js']) {
      const runtimeEntry = path.join(root, candidate)
      if (!fs.pathExistsSync(runtimeEntry)) {
        continue
      }

      const runtimeModule = require.cache[runtimeEntry]?.exports as
        | {
        contextRef?: { value?: unknown[] }
      }
        | undefined
      runtimeModule?.contextRef?.value?.splice(0, runtimeModule.contextRef.value.length)
      break
    }
  }
  catch {
    // best-effort cleanup for Tailwind v3 runtime state
  }
}

async function resolveConfigPath(options: TailwindBuildOptions) {
  if (options.config && path.isAbsolute(options.config)) {
    return options.config
  }

  const result = await loadConfig({ cwd: options.cwd })
  if (!result) {
    throw new Error(`Unable to locate Tailwind CSS config from ${options.cwd}`)
  }
  return result.filepath
}

export async function runTailwindBuild(options: TailwindBuildOptions) {
  const configPath = await resolveConfigPath(options)
  const pluginName = options.postcssPlugin ?? (options.majorVersion === 4 ? '@tailwindcss/postcss' : 'tailwindcss')

  if (options.majorVersion === 3) {
    clearTailwindV3RuntimeState(pluginName)
  }

  if (options.majorVersion === 4) {
    return postcss([
      require(pluginName)({
        config: configPath,
      }),
    ]).process('@import \'tailwindcss\';', {
      from: undefined,
    })
  }

  return postcss([
    require(pluginName)({
      config: configPath,
    }),
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
  })
}

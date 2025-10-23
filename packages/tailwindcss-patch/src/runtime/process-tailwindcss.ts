import { createRequire } from 'node:module'
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

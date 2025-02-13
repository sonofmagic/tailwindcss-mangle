import { createRequire } from 'node:module'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'
import path from 'pathe'
import postcss from 'postcss'
import { loadConfig } from 'tailwindcss-config'

const require = createRequire(import.meta.url)
export interface ProcessTailwindcssOptions {
  cwd?: string
  config?: string
  majorVersion?: number
  postcssPlugin?: string
}

export async function processTailwindcss(options: ProcessTailwindcssOptions) {
  const { config: userConfig, cwd, majorVersion, postcssPlugin } = defu<ProcessTailwindcssOptions, ProcessTailwindcssOptions[]>(options, {
    cwd: process.cwd(),
    majorVersion: 3,
  })
  let config = userConfig
  // 没有具体指定的话，就走下面的分支
  if (!(typeof config === 'string' && path.isAbsolute(config))) {
    const result = await loadConfig({
      cwd,
    })
    if (!result) {
      throw new Error(`No TailwindCSS Config found in: ${cwd}`)
    }
    config = result.filepath
  }
  const targetPostcssPlugin = postcssPlugin ?? (majorVersion === 4 ? '@tailwindcss/postcss' : 'tailwindcss')
  if (majorVersion === 4) {
    return await postcss([
      require(targetPostcssPlugin)({
        config,
      }),
    ]).process('@import \'tailwindcss\';', {
      from: undefined,
    })
  }

  return await postcss([
    require(targetPostcssPlugin)({
      config,
    }),
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
  })
}

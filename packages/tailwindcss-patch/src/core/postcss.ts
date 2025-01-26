import { createRequire } from 'node:module'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'
import { createJiti } from 'jiti'
import { lilconfig } from 'lilconfig'
import path from 'pathe'
import postcss from 'postcss'

const jiti = createJiti(import.meta.url)
const require = createRequire(import.meta.url)
export interface ProcessTailwindcssOptions {
  cwd?: string
  config?: string
  majorVersion?: number
}

export async function processTailwindcss(options: ProcessTailwindcssOptions) {
  const { config: userConfig, cwd, majorVersion } = defu<ProcessTailwindcssOptions, ProcessTailwindcssOptions[]>(options, {
    cwd: process.cwd(),
    majorVersion: 3,
  })
  let config = userConfig
  // 没有具体指定的话，就走下面的分支
  if (!(typeof config === 'string' && path.isAbsolute(config))) {
    const moduleName = 'tailwind'

    const result = await lilconfig('tailwindcss', {
      searchPlaces: [
        `${moduleName}.config.js`,
        `${moduleName}.config.cjs`,
        `${moduleName}.config.mjs`,
        `${moduleName}.config.ts`,
        `${moduleName}.config.cts`,
        `${moduleName}.config.mts`,
      ],
      loaders: {
        // 默认支持 js 和 cjs 2种格式
        '.js': jiti,
        '.cjs': jiti,
        '.mjs': jiti,
        '.ts': jiti,
        '.cts': jiti,
        '.mts': jiti,
      },
    }).search(cwd)
    if (!result) {
      throw new Error(`No TailwindCSS Config found in: ${cwd}`)
    }
    config = result.filepath
  }

  if (majorVersion === 4) {
    return await postcss([
      require('@tailwindcss/postcss')({
        config,
      }),
    ]).process('@import \'tailwindcss\';', {
      from: undefined,
    })
  }

  return await postcss([
    require('tailwindcss')({
      config,
    }),
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
  })
}

import path from 'node:path'
import process from 'node:process'
import { jiti } from '@/jiti'
import { defu, requireResolve } from '@/utils'
import { lilconfig } from 'lilconfig'
import postcss from 'postcss'

export interface ProcessTailwindcssOptions {
  cwd?: string
  config?: string
}

export async function processTailwindcss(options: ProcessTailwindcssOptions) {
  const { config: userConfig, cwd } = defu<ProcessTailwindcssOptions, ProcessTailwindcssOptions[]>(options, {
    cwd: process.cwd(),
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
  const id = requireResolve('tailwindcss', {
    basedir: cwd,
  })
  return await postcss([
    // eslint-disable-next-line ts/no-require-imports
    require(id)({
      config,
    }),
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
  })
}

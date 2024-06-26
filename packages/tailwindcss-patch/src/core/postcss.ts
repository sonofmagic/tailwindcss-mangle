import path from 'node:path'
import process from 'node:process'
import postcss from 'postcss'
import { lilconfig } from 'lilconfig'
import createJiti from 'jiti'
import { requireResolve } from '@/utils'

const jiti = createJiti(__filename)

export async function processTailwindcss(options: { cwd?: string, config?: string }) {
  options.cwd = options.cwd ?? process.cwd()
  let config = options.config
  // 没有具体指定的话，就走下面的分支
  if (!(typeof options.config === 'string' && path.isAbsolute(options.config))) {
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
    }).search(options.cwd)
    if (!result) {
      throw new Error(`No TailwindCSS Config found in: ${options.cwd}`)
    }
    config = result.filepath
  }
  const id = requireResolve('tailwindcss', {
    basedir: options.cwd,
  })
  return await postcss([
    // eslint-disable-next-line ts/no-var-requires, ts/no-require-imports
    require(id)({
      config,
    }),
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined,
  })
}

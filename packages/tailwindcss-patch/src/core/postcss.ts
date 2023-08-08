import postcss from 'postcss'
import path from 'node:path'
import { lilconfig } from 'lilconfig'

// const importDefault = async (filepath: string) => {
//   const module = await import(url.pathToFileURL(filepath).href)
//   return module.default
// }

export async function processTailwindcss(options: { cwd?: string; config?: string }) {
  options.cwd = options.cwd ?? process.cwd()
  let config = options.config
  // 没有具体指定的话，就走下面的分支
  if (!(typeof options.config === 'string' && path.isAbsolute(options.config))) {
    const moduleName = 'tailwind'
    const result = await lilconfig('tailwindcss', {
      searchPlaces: [`${moduleName}.config.js`, `${moduleName}.config.cjs`],
      loaders: {
        // 默认支持 js 和 cjs 2种格式
        '.js': require,
        '.cjs': require
      }
    }).search(options.cwd)
    if (!result) {
      throw new Error(`No TailwindCSS Config found in: ${options.cwd}`)
    }
    config = result.filepath
  }

  return await postcss([
    require('tailwindcss')({
      config
    })
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined
  })
}

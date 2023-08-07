import postcss from 'postcss'
import path from 'node:path'

export async function processTailwindcss(options: { cwd?: string; config?: string }) {
  options.cwd = options.cwd ?? process.cwd()
  const config = options.config && path.isAbsolute(options.config) ? options.config : path.resolve(options.cwd, 'tailwind.config.js')

  const res = await postcss([
    require('tailwindcss')({
      config
    })
  ]).process('@tailwind base;@tailwind components;@tailwind utilities;', {
    from: undefined
  })
  return res
}

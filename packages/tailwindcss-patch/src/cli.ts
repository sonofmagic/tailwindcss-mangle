import { createPatch, getPatchOptions, TailwindcssPatcher, getConfig } from './core'
import cac from 'cac'
import dedent from 'dedent'
import path from 'node:path'
import fs from 'node:fs/promises'

function init() {
  const cwd = process.cwd()
  return fs.writeFile(
    path.resolve(cwd, 'tailwindcss-patch.config.ts'),
    dedent`
      import { defineConfig } from 'tailwindcss-patch'

      export default defineConfig({})
    `,
    'utf8'
  )
}

const cli = cac()

cli.command('install', 'patch install').action(() => {
  const opt = getPatchOptions()
  const patch = createPatch(opt)
  patch()
})

cli.command('init').action(async () => {
  await init()
  console.log('✨ tailwindcss-patch config initialized!')
})

cli.command('extract').action(async () => {
  const { config } = await getConfig()
  if (config?.output?.filename) {
    const twPatcher = new TailwindcssPatcher()
    await twPatcher.extract({
      filename: config.output.filename,
      configDir: config.postcss?.configDir!,
      loose: config.postcss?.loose!
    })
  }
})

cli.help()

cli.parse()

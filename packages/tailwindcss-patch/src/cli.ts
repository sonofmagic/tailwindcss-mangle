import type { PatchUserConfig } from '@tailwindcss-mangle/config'
import process from 'node:process'
import { CONFIG_NAME, getConfig, initConfig } from '@tailwindcss-mangle/config'
import { defuOverrideArray } from '@tailwindcss-mangle/shared'
import cac from 'cac'
import { TailwindcssPatcher } from './core'
import { getPatchOptions } from './defaults'
import logger from './logger'

function init() {
  const cwd = process.cwd()
  return initConfig(cwd)
}

const cli = cac()

cli.command('install', 'patch install').action(() => {
  const twPatcher = new TailwindcssPatcher({
    patch: getPatchOptions(),
  })
  twPatcher.patch()
})

cli.command('init').action(async () => {
  await init()
  logger.success(`✨ ${CONFIG_NAME}.config.ts initialized!`)
})

cli.command('extract')
  .option('--css [file]', 'css file entries')
  .action(async (options) => {
    const { config } = await getConfig()
    const file = options.css as string
    if (config) {
      const twPatcher = new TailwindcssPatcher(
        {
          patch: defuOverrideArray(
            config.patch!,
            {
              resolve: {
                paths: [import.meta.url],
              },
              tailwindcss: {
                v4: {
                  cssEntries: file ? [file] : undefined,
                },
              },
            } as Partial<PatchUserConfig>,
          ),
        },
      )
      const p = await twPatcher.extract()
      p && logger.success(`✨ tailwindcss-patch extract success! file path: ${p.filename}, classList length: ${p.classList.length}`)
    }
  })

cli.help()

cli.parse()

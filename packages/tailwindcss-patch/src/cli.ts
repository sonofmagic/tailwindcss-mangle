import process from 'node:process'
import { CONFIG_NAME, getConfig, initConfig } from '@tailwindcss-mangle/config'
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

cli.command('extract').action(async () => {
  const { config } = await getConfig()
  if (config) {
    const twPatcher = new TailwindcssPatcher()
    const p = await twPatcher.extract(config.patch)
    logger.success(`✨ tailwindcss-patch extract success! file path: ${p}`)
  }
})

cli.help()

cli.parse()

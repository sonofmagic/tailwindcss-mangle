import cac from 'cac'
import { configName, getConfig, initConfig } from './config'
import { TailwindcssPatcher, createPatch, getPatchOptions } from './core'

function init() {
  const cwd = process.cwd()
  return initConfig(cwd)
}

const cli = cac()

cli.command('install', 'patch install').action(() => {
  const opt = getPatchOptions()
  const patch = createPatch(opt)
  patch()
})

cli.command('init').action(async () => {
  await init()
  console.log(`✨ ${configName}.config.ts initialized!`)
})

cli.command('extract').action(async () => {
  const { config } = await getConfig()
  if (config) {
    const twPatcher = new TailwindcssPatcher()
    const p = await twPatcher.extract(config.patch)
    console.log(`✨ tailwindcss-patch extract success! file path: ${p}`)
  }
})

cli.help()

cli.parse()

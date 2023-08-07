import { createPatch, getPatchOptions, TailwindcssPatcher, getConfig, initConfig } from './core'
import cac from 'cac'

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
  console.log('✨ tailwindcss-patch config initialized!')
})

cli.command('extract').action(async () => {
  const { config } = await getConfig()
  if (config) {
    const twPatcher = new TailwindcssPatcher()
    const p = await twPatcher.extract(config)
    console.log('✨ tailwindcss-patch extract success! file path:\n' + p)
  }
})

cli.help()

cli.parse()

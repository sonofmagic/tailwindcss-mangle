import { createPatch, getPatchOptions } from './core'
import cac from 'cac'

const cli = cac()

cli.command('install', 'patch install').action(() => {
  const opt = getPatchOptions()
  const patch = createPatch(opt)
  patch()
})

cli.help()

cli.parse()

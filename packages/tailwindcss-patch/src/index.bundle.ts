import type { CAC } from 'cac'
import type { TailwindcssPatchCliMountOptions, TailwindcssPatchCliOptions } from './commands/types'

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

type CliModule = typeof import('./commands/cli')

function loadCliModule(): CliModule {
  return require('./commands/cli-runtime.js') as CliModule
}

export * from './public-api'

export function mountTailwindcssPatchCommands(cli: CAC, options: TailwindcssPatchCliMountOptions = {}) {
  return loadCliModule().mountTailwindcssPatchCommands(cli, options)
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  return loadCliModule().createTailwindcssPatchCli(options)
}

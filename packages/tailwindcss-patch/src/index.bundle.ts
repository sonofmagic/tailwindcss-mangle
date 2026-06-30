import type { TailwindcssPatchCliOptions } from './commands/types'

import { createTailwindcssPatchCli as createCli, mountTailwindcssPatchCommands as mountCommands } from './commands/cli'

export * from './public-api'

export function mountTailwindcssPatchCommands(...args: Parameters<typeof mountCommands>) {
  return mountCommands(...args)
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  return createCli(options)
}

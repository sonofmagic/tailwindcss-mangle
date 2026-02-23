import process from 'node:process'
import { createTailwindcssPatchCli, ValidateCommandError } from './commands/cli'
import logger from './logger'

async function main() {
  const cli = createTailwindcssPatchCli()
  cli.help()
  cli.parse(process.argv, { run: false })
  await cli.runMatchedCommand()
}

main().catch((error) => {
  if (error instanceof ValidateCommandError) {
    process.exitCode = error.exitCode
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  logger.error(message)
  process.exitCode = 1
})

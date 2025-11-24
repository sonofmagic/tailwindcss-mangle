import { createTailwindcssPatchCli } from './cli/commands'

const cli = createTailwindcssPatchCli()
cli.help()
cli.parse()

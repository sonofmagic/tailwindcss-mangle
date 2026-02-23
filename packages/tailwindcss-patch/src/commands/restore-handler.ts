import type { TailwindcssPatchCommandContext } from './types'

import { restoreConfigFiles } from './migrate-config'
import { resolveRestoreCommandArgs } from './migration-args'
import { logRestoreResultAsJson, logRestoreSummary } from './migration-output'

export async function restoreCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'restore'>) {
  const { args } = ctx
  const restoreArgs = resolveRestoreCommandArgs(args)
  const result = await restoreConfigFiles({
    cwd: ctx.cwd,
    reportFile: restoreArgs.reportFile,
    dryRun: restoreArgs.dryRun,
    strict: restoreArgs.strict,
  })

  if (args.json) {
    logRestoreResultAsJson(result)
    return result
  }

  logRestoreSummary(result)
  return result
}

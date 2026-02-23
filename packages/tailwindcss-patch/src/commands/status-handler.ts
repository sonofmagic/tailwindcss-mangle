import type { TailwindcssPatchCommandContext } from './types'

import { logStatusReportAsJson, logStatusReportSummary } from './status-output'

export async function statusCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'status'>) {
  const patcher = await ctx.createPatcher()
  const report = await patcher.getPatchStatus()

  if (ctx.args.json) {
    logStatusReportAsJson(report)
    return report
  }

  logStatusReportSummary(report)

  return report
}

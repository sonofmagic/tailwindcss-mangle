import type { PatchStatusReport } from '../types'
import type { TailwindcssPatchCommandContext } from './types'

import logger from '../logger'

function formatFilesHint(entry: PatchStatusReport['entries'][number]) {
  if (!entry.files.length) {
    return ''
  }
  return ` (${entry.files.join(', ')})`
}

export async function statusCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'status'>) {
  const patcher = await ctx.createPatcher()
  const report = await patcher.getPatchStatus()

  if (ctx.args.json) {
    logger.log(JSON.stringify(report, null, 2))
    return report
  }

  const applied = report.entries.filter(entry => entry.status === 'applied')
  const pending = report.entries.filter(entry => entry.status === 'not-applied')
  const skipped = report.entries.filter(entry => entry.status === 'skipped' || entry.status === 'unsupported')

  const packageLabel = `${report.package.name ?? 'tailwindcss'}@${report.package.version ?? 'unknown'}`
  logger.info(`Patch status for ${packageLabel} (v${report.majorVersion})`)

  if (applied.length) {
    logger.success('Applied:')
    applied.forEach(entry => logger.success(`  • ${entry.name}${formatFilesHint(entry)}`))
  }

  if (pending.length) {
    logger.warn('Needs attention:')
    pending.forEach((entry) => {
      const details = entry.reason ? ` – ${entry.reason}` : ''
      logger.warn(`  • ${entry.name}${formatFilesHint(entry)}${details}`)
    })
  }
  else {
    logger.success('All applicable patches are applied.')
  }

  if (skipped.length) {
    logger.info('Skipped:')
    skipped.forEach((entry) => {
      const details = entry.reason ? ` – ${entry.reason}` : ''
      logger.info(`  • ${entry.name}${details}`)
    })
  }

  return report
}

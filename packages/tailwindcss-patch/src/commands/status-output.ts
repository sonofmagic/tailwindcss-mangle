import type { PatchStatusReport } from '../types'

import logger from '../logger'

function formatFilesHint(entry: PatchStatusReport['entries'][number]) {
  if (!entry.files.length) {
    return ''
  }
  return ` (${entry.files.join(', ')})`
}

function formatPackageLabel(report: PatchStatusReport) {
  return `${report.package.name ?? 'tailwindcss'}@${report.package.version ?? 'unknown'}`
}

function partitionStatusEntries(report: PatchStatusReport) {
  return {
    applied: report.entries.filter(entry => entry.status === 'applied'),
    pending: report.entries.filter(entry => entry.status === 'not-applied'),
    skipped: report.entries.filter(entry => entry.status === 'skipped' || entry.status === 'unsupported'),
  }
}

export function logStatusReportAsJson(report: PatchStatusReport) {
  logger.log(JSON.stringify(report, null, 2))
}

export function logStatusReportSummary(report: PatchStatusReport) {
  const {
    applied,
    pending,
    skipped,
  } = partitionStatusEntries(report)

  logger.info(`Patch status for ${formatPackageLabel(report)} (v${report.majorVersion})`)

  if (applied.length) {
    logger.success('Applied:')
    applied.forEach(entry => logger.success(`  • ${entry.name}${formatFilesHint(entry)}`))
  }

  if (pending.length) {
    logger.warn('Needs attention:')
    pending.forEach((entry) => {
      const details = entry.reason ? ` - ${entry.reason}` : ''
      logger.warn(`  • ${entry.name}${formatFilesHint(entry)}${details}`)
    })
  }
  else {
    logger.success('All applicable patches are applied.')
  }

  if (skipped.length) {
    logger.info('Skipped:')
    skipped.forEach((entry) => {
      const details = entry.reason ? ` - ${entry.reason}` : ''
      logger.info(`  • ${entry.name}${details}`)
    })
  }
}

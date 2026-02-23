import type { RestoreReportEntry } from './migration-file-executor'

import fs from 'fs-extra'
import { assertMigrationReportCompatibility } from './migration-report'

export interface LoadedMigrationReportForRestore {
  reportKind?: string
  schemaVersion?: number
  entries: RestoreReportEntry[]
}

export async function loadMigrationReportForRestore(reportFile: string): Promise<LoadedMigrationReportForRestore> {
  const report = await fs.readJSON(reportFile) as {
    reportKind?: string
    schemaVersion?: number
    entries?: RestoreReportEntry[]
  }

  assertMigrationReportCompatibility(report, reportFile)

  return {
    ...(report.reportKind === undefined ? {} : { reportKind: report.reportKind }),
    ...(report.schemaVersion === undefined ? {} : { schemaVersion: report.schemaVersion }),
    entries: Array.isArray(report.entries) ? report.entries : [],
  }
}

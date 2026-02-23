export const MIGRATION_REPORT_KIND = 'tw-patch-migrate-report'
export const MIGRATION_REPORT_SCHEMA_VERSION = 1

export interface MigrationReportInput {
  reportKind?: string
  schemaVersion?: number
}

export function assertMigrationReportCompatibility(report: MigrationReportInput, reportFile: string) {
  if (report.reportKind !== undefined && report.reportKind !== MIGRATION_REPORT_KIND) {
    throw new Error(`Unsupported report kind "${report.reportKind}" in ${reportFile}.`)
  }
  if (
    report.schemaVersion !== undefined
    && (!Number.isInteger(report.schemaVersion) || report.schemaVersion > MIGRATION_REPORT_SCHEMA_VERSION)
  ) {
    throw new Error(
      `Unsupported report schema version "${String(report.schemaVersion)}" in ${reportFile}. Current supported version is ${MIGRATION_REPORT_SCHEMA_VERSION}.`,
    )
  }
}

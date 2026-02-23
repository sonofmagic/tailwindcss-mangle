import { describe, expect, it } from 'vitest'
import {
  assertMigrationReportCompatibility,
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
} from '../src/commands/migration-report'

describe('migration report helpers', () => {
  it('accepts compatible report metadata', () => {
    expect(() => {
      assertMigrationReportCompatibility({
        reportKind: MIGRATION_REPORT_KIND,
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
      }, '/repo/report.json')
    }).not.toThrow()
  })

  it('rejects incompatible report kind', () => {
    expect(() => {
      assertMigrationReportCompatibility({
        reportKind: 'custom-kind',
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
      }, '/repo/report.json')
    }).toThrow('Unsupported report kind "custom-kind" in /repo/report.json.')
  })

  it('rejects unsupported report schema version', () => {
    expect(() => {
      assertMigrationReportCompatibility({
        reportKind: MIGRATION_REPORT_KIND,
        schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION + 1,
      }, '/repo/report.json')
    }).toThrow(`Current supported version is ${MIGRATION_REPORT_SCHEMA_VERSION}.`)
  })
})

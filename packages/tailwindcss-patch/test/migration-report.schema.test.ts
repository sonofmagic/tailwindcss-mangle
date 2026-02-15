import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
  migrateConfigFiles,
  restoreConfigFiles,
} from '../src'

describe('migration report public exports', () => {
  it('exports migration report constants and helpers from package entry', () => {
    expect(MIGRATION_REPORT_KIND).toBe('tw-patch-migrate-report')
    expect(MIGRATION_REPORT_SCHEMA_VERSION).toBe(1)
    expect(migrateConfigFiles).toBeTypeOf('function')
    expect(restoreConfigFiles).toBeTypeOf('function')
  })
})

describe('migration report json schema', () => {
  it('ships a migration-report schema file aligned with exported constants', async () => {
    const schemaPath = path.resolve(process.cwd(), 'schema/migration-report.schema.json')
    const schema = await fs.readJSON(schemaPath) as Record<string, any>

    expect(schema.$schema).toContain('json-schema.org')
    expect(schema.type).toBe('object')
    expect(schema.required).toContain('entries')
    expect(schema.properties.reportKind.const).toBe(MIGRATION_REPORT_KIND)
    expect(schema.properties.schemaVersion.const).toBe(MIGRATION_REPORT_SCHEMA_VERSION)
    expect(schema.$defs.entry.required).toEqual(
      expect.arrayContaining(['file', 'changed', 'written', 'rolledBack', 'changes']),
    )
  })
})

describe('restore result json schema', () => {
  it('ships a restore-result schema file aligned with exported constants', async () => {
    const schemaPath = path.resolve(process.cwd(), 'schema/restore-result.schema.json')
    const schema = await fs.readJSON(schemaPath) as Record<string, any>

    expect(schema.$schema).toContain('json-schema.org')
    expect(schema.type).toBe('object')
    expect(schema.required).toEqual(
      expect.arrayContaining(['reportFile', 'dryRun', 'restored', 'missingBackups']),
    )
    expect(schema.properties.reportKind.const).toBe(MIGRATION_REPORT_KIND)
    expect(schema.properties.reportSchemaVersion.minimum).toBe(MIGRATION_REPORT_SCHEMA_VERSION)
  })
})

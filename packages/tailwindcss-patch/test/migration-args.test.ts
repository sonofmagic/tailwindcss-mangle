import { describe, expect, it } from 'vitest'
import {
  normalizePatternArgs,
  resolveMigrateCommandArgs,
  resolveRestoreCommandArgs,
  resolveValidateCommandArgs,
} from '../src/commands/migration-args'

describe('migration args', () => {
  it('normalizes include and exclude pattern arguments', () => {
    expect(normalizePatternArgs()).toBeUndefined()
    expect(normalizePatternArgs('')).toBeUndefined()
    expect(normalizePatternArgs('src/**, test/**')).toEqual(['src/**', 'test/**'])
    expect(normalizePatternArgs(['src/**,docs/**', ' test/** '])).toEqual(['src/**', 'docs/**', 'test/**'])
  })

  it('resolves dryRun using check mode when dryRun is not provided', () => {
    const resolved = resolveMigrateCommandArgs({
      cwd: '/repo',
      check: true,
    })

    expect(resolved.checkMode).toBe(true)
    expect(resolved.dryRun).toBe(true)
    expect(resolved.hasInvalidMaxDepth).toBe(false)
  })

  it('parses maxDepth and tracks invalid values', () => {
    expect(resolveMigrateCommandArgs({
      cwd: '/repo',
      maxDepth: '3.8',
    })).toMatchObject({
      maxDepth: 3,
      hasInvalidMaxDepth: false,
    })

    expect(resolveMigrateCommandArgs({
      cwd: '/repo',
      maxDepth: '-1',
    })).toMatchObject({
      maxDepth: undefined,
      hasInvalidMaxDepth: true,
    })

    expect(resolveMigrateCommandArgs({
      cwd: '/repo',
      maxDepth: 'NaN',
    })).toMatchObject({
      maxDepth: undefined,
      hasInvalidMaxDepth: true,
    })
  })

  it('resolves restore command defaults', () => {
    expect(resolveRestoreCommandArgs({
      cwd: '/repo',
    })).toEqual({
      reportFile: '.tw-patch/migrate-report.json',
      dryRun: false,
      strict: false,
    })

    expect(resolveRestoreCommandArgs({
      cwd: '/repo',
      reportFile: 'custom.json',
      dryRun: true,
      strict: true,
    })).toEqual({
      reportFile: 'custom.json',
      dryRun: true,
      strict: true,
    })
  })

  it('resolves validate command defaults', () => {
    expect(resolveValidateCommandArgs({
      cwd: '/repo',
    })).toEqual({
      reportFile: '.tw-patch/migrate-report.json',
      strict: false,
    })

    expect(resolveValidateCommandArgs({
      cwd: '/repo',
      reportFile: 'custom.json',
      strict: true,
    })).toEqual({
      reportFile: 'custom.json',
      strict: true,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { normalizePatternArgs, resolveMigrateCommandArgs } from '../src/commands/migration-args'

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
})

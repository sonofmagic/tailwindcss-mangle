import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/commands/migrate-config', () => ({
  migrateConfigFiles: vi.fn(),
  restoreConfigFiles: vi.fn(),
}))

import logger from '../src/logger'
import { migrateConfigFiles, restoreConfigFiles } from '../src/commands/migrate-config'
import { migrateCommandDefaultHandler } from '../src/commands/migrate-handler'
import { restoreCommandDefaultHandler } from '../src/commands/restore-handler'
import { statusCommandDefaultHandler } from '../src/commands/status-handler'
import { validateCommandDefaultHandler } from '../src/commands/validate-handler'
import { VALIDATE_EXIT_CODES, ValidateCommandError } from '../src/commands/validate'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('status handler module', () => {
  it('prints json report when --json is enabled', async () => {
    const report = {
      package: { name: 'tailwindcss', version: '3.4.0', root: '/repo' },
      majorVersion: 3 as const,
      entries: [],
    }

    const logSpy = vi.spyOn(logger as any, 'log').mockImplementation(() => undefined)
    const ctx = {
      args: { cwd: '/repo', json: true },
      createPatcher: async () => ({
        getPatchStatus: async () => report,
      }),
    } as any

    const result = await statusCommandDefaultHandler(ctx)
    expect(result).toEqual(report)
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(report, null, 2))
  })

  it('prints readable status summary when --json is disabled', async () => {
    const report = {
      package: { name: 'tailwindcss', version: '3.4.0', root: '/repo' },
      majorVersion: 3 as const,
      entries: [
        { name: 'exposeContext', status: 'applied', files: ['a.js'] },
        { name: 'extendLengthUnits', status: 'not-applied', files: ['b.js'], reason: 'missing patch' },
        { name: 'exposeContext', status: 'skipped', files: [], reason: 'unsupported' },
      ],
    }

    const infoSpy = vi.spyOn(logger as any, 'info').mockImplementation(() => undefined)
    const successSpy = vi.spyOn(logger as any, 'success').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(logger as any, 'warn').mockImplementation(() => undefined)

    const ctx = {
      args: { cwd: '/repo', json: false },
      createPatcher: async () => ({
        getPatchStatus: async () => report,
      }),
    } as any

    await statusCommandDefaultHandler(ctx)

    expect(infoSpy).toHaveBeenCalledWith('Patch status for tailwindcss@3.4.0 (v3)')
    expect(successSpy).toHaveBeenCalledWith('Applied:')
    expect(warnSpy).toHaveBeenCalledWith('Needs attention:')
    expect(infoSpy).toHaveBeenCalledWith('Skipped:')
  })
})

describe('migration handlers module', () => {
  it('migrate handler normalizes args and warns for invalid workspace maxDepth', async () => {
    const migrateMock = vi.mocked(migrateConfigFiles)
    const report = {
      scannedFiles: 0,
      changedFiles: 0,
      writtenFiles: 0,
      backupsWritten: 0,
      unchangedFiles: 0,
      missingFiles: 0,
      entries: [],
    }
    migrateMock.mockResolvedValueOnce(report as any)
    const warnSpy = vi.spyOn(logger as any, 'warn').mockImplementation(() => undefined)

    const ctx = {
      cwd: '/repo',
      args: {
        cwd: '/repo',
        workspace: true,
        maxDepth: '-2',
        include: 'apps/**,packages/**',
        exclude: ['node_modules/**'],
        json: false,
      },
    } as any

    const result = await migrateCommandDefaultHandler(ctx)
    expect(result).toEqual(report)
    expect(migrateMock).toHaveBeenCalledWith({
      cwd: '/repo',
      dryRun: false,
      workspace: true,
      include: ['apps/**', 'packages/**'],
      exclude: ['node_modules/**'],
    })
    expect(warnSpy).toHaveBeenCalledWith('Invalid --max-depth value "-2", fallback to default depth.')
    expect(warnSpy).toHaveBeenCalledWith('No config files found for migration.')
  })

  it('migrate handler enables dry-run in check mode and throws when changes are required', async () => {
    const migrateMock = vi.mocked(migrateConfigFiles)
    const report = {
      scannedFiles: 2,
      changedFiles: 1,
      writtenFiles: 0,
      backupsWritten: 0,
      unchangedFiles: 1,
      missingFiles: 0,
      entries: [],
    }
    migrateMock.mockResolvedValueOnce(report as any)
    const logSpy = vi.spyOn(logger as any, 'log').mockImplementation(() => undefined)

    const ctx = {
      cwd: '/repo',
      args: {
        cwd: '/repo',
        check: true,
        json: true,
      },
    } as any

    await expect(migrateCommandDefaultHandler(ctx)).rejects.toThrow(
      'Migration check failed: 1 file(s) still need migration.',
    )
    expect(migrateMock).toHaveBeenCalledWith({
      cwd: '/repo',
      dryRun: true,
    })
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(report, null, 2))
  })

  it('restore handler emits json payload and returns restore result', async () => {
    const restoreResult = {
      cwd: '/repo',
      reportFile: '.tw-patch/migrate-report.json',
      dryRun: false,
      strict: false,
      scannedEntries: 2,
      restorableEntries: 2,
      restoredFiles: 2,
      missingBackups: 0,
      skippedEntries: 0,
      restored: ['/repo/a.ts', '/repo/b.ts'],
    }
    const restoreMock = vi.mocked(restoreConfigFiles)
    restoreMock.mockResolvedValueOnce(restoreResult as any)
    const logSpy = vi.spyOn(logger as any, 'log').mockImplementation(() => undefined)

    const ctx = {
      cwd: '/repo',
      args: { cwd: '/repo', json: true },
    } as any

    const result = await restoreCommandDefaultHandler(ctx)
    expect(result).toEqual(restoreResult)
    expect(restoreMock).toHaveBeenCalledWith({
      cwd: '/repo',
      reportFile: '.tw-patch/migrate-report.json',
      dryRun: false,
      strict: false,
    })
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(restoreResult, null, 2))
  })

  it('validate handler emits failure payload and throws ValidateCommandError', async () => {
    const restoreMock = vi.mocked(restoreConfigFiles)
    restoreMock.mockRejectedValueOnce(new Error('Restore failed: backup not found'))
    const logSpy = vi.spyOn(logger as any, 'log').mockImplementation(() => undefined)

    const ctx = {
      cwd: '/repo',
      args: { cwd: '/repo', json: true },
    } as any

    await expect(validateCommandDefaultHandler(ctx)).rejects.toBeInstanceOf(ValidateCommandError)
    const payload = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}')
    expect(payload).toMatchObject({
      ok: false,
      reason: 'missing-backups',
      exitCode: VALIDATE_EXIT_CODES.MISSING_BACKUPS,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { logStatusReportAsJson, logStatusReportSummary } from '../src/commands/status-output'
import logger from '../src/logger'

vi.mock('../src/logger', () => {
  return {
    default: {
      success: vi.fn(),
      warn: vi.fn(),
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  }
})

describe('status output helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs status report as JSON', () => {
    const report = {
      package: { name: 'tailwindcss', version: '3.4.0', root: '/repo' },
      majorVersion: 3,
      entries: [],
    } as any

    logStatusReportAsJson(report)

    expect(logger.log).toHaveBeenCalledWith(JSON.stringify(report, null, 2))
  })

  it('logs summary with applied, pending and skipped groups', () => {
    const report = {
      package: { name: 'tailwindcss', version: '3.4.0', root: '/repo' },
      majorVersion: 3,
      entries: [
        { name: 'exposeContext', status: 'applied', files: ['a.js'] },
        { name: 'extendLengthUnits', status: 'not-applied', files: ['b.js'], reason: 'missing patch' },
        { name: 'v4Patch', status: 'unsupported', files: [], reason: 'not needed' },
      ],
    } as any

    logStatusReportSummary(report)

    expect(logger.info).toHaveBeenCalledWith('Patch status for tailwindcss@3.4.0 (v3)')
    expect(logger.success).toHaveBeenCalledWith('Applied:')
    expect(logger.success).toHaveBeenCalledWith('  • exposeContext (a.js)')
    expect(logger.warn).toHaveBeenCalledWith('Needs attention:')
    expect(logger.warn).toHaveBeenCalledWith('  • extendLengthUnits (b.js) - missing patch')
    expect(logger.info).toHaveBeenCalledWith('Skipped:')
    expect(logger.info).toHaveBeenCalledWith('  • v4Patch - not needed')
  })

  it('logs all-applied hint when no pending entries exist', () => {
    const report = {
      package: { name: 'tailwindcss', version: '3.4.0', root: '/repo' },
      majorVersion: 3,
      entries: [
        { name: 'exposeContext', status: 'applied', files: [] },
      ],
    } as any

    logStatusReportSummary(report)

    expect(logger.success).toHaveBeenCalledWith('All applicable patches are applied.')
  })

  it('uses fallback labels and handles pending/skipped entries without reasons', () => {
    const report = {
      package: {},
      majorVersion: 4,
      entries: [
        { name: 'a', status: 'not-applied', files: [] },
        { name: 'b', status: 'skipped', files: [] },
      ],
    } as any

    logStatusReportSummary(report)

    expect(logger.info).toHaveBeenCalledWith('Patch status for tailwindcss@unknown (v4)')
    expect(logger.warn).toHaveBeenCalledWith('  • a')
    expect(logger.info).toHaveBeenCalledWith('  • b')
  })
})

import type { TailwindTokenByFileMap, TailwindTokenLocation } from '../src/types'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOKEN_REPORT,
  formatGroupedPreview,
  formatTokenLine,
  TOKEN_FORMATS,
} from '../src/commands/token-output'
import {
  classifyValidateError,
  VALIDATE_EXIT_CODES,
  ValidateCommandError,
} from '../src/commands/validate'

describe('commands/token-output', () => {
  it('exports supported token formats and default report path', () => {
    expect(TOKEN_FORMATS).toEqual(['json', 'lines', 'grouped-json'])
    expect(DEFAULT_TOKEN_REPORT).toBe('.tw-patch/tw-token-report.json')
  })

  it('formats token line output with location and offsets', () => {
    const entry: TailwindTokenLocation = {
      rawCandidate: 'text-red-500',
      file: '/repo/src/App.tsx',
      relativeFile: 'src/App.tsx',
      extension: '.tsx',
      start: 10,
      end: 22,
      length: 12,
      line: 3,
      column: 15,
      lineText: '<div className="text-red-500" />',
    }

    expect(formatTokenLine(entry)).toBe('src/App.tsx:3:15 text-red-500 (10-22)')
  })

  it('builds grouped preview with count and sample, including overflow markers', () => {
    const map: TailwindTokenByFileMap = {
      'src/a.ts': [
        { rawCandidate: 'a-1' },
        { rawCandidate: 'a-2' },
        { rawCandidate: 'a-3' },
        { rawCandidate: 'a-4' },
      ] as TailwindTokenLocation[],
      'src/b.ts': [{ rawCandidate: 'b-1' }] as TailwindTokenLocation[],
      'src/c.ts': [{ rawCandidate: 'c-1' }] as TailwindTokenLocation[],
      'src/d.ts': [{ rawCandidate: 'd-1' }] as TailwindTokenLocation[],
    }

    const preview = formatGroupedPreview(map, 2)
    expect(preview.moreFiles).toBe(2)
    expect(preview.preview).toContain('src/a.ts: 4 tokens (a-1, a-2, a-3, …)')
    expect(preview.preview).toContain('src/b.ts: 1 tokens (b-1)')
  })

  it('returns empty preview when no files exist', () => {
    expect(formatGroupedPreview({})).toEqual({ preview: '', moreFiles: 0 })
  })
})

describe('commands/validate', () => {
  it('classifies report compatibility errors', () => {
    const summary = classifyValidateError(new Error('Unsupported report kind: foo'))
    expect(summary).toEqual({
      reason: 'report-incompatible',
      exitCode: VALIDATE_EXIT_CODES.REPORT_INCOMPATIBLE,
      message: 'Unsupported report kind: foo',
    })
  })

  it('classifies restore failures as missing backups', () => {
    const summary = classifyValidateError(new Error('Restore failed: backup file missing'))
    expect(summary.reason).toBe('missing-backups')
    expect(summary.exitCode).toBe(VALIDATE_EXIT_CODES.MISSING_BACKUPS)
  })

  it('classifies filesystem errno errors as io-error', () => {
    const summary = classifyValidateError({
      code: 'EPERM',
      message: 'Operation not permitted',
    } satisfies NodeJS.ErrnoException)

    expect(summary.reason).toBe('io-error')
    expect(summary.exitCode).toBe(VALIDATE_EXIT_CODES.IO_ERROR)
  })

  it('falls back to unknown error and exposes ValidateCommandError metadata', () => {
    const summary = classifyValidateError('unexpected')
    const error = new ValidateCommandError(summary)

    expect(summary.reason).toBe('unknown-error')
    expect(summary.exitCode).toBe(VALIDATE_EXIT_CODES.UNKNOWN_ERROR)
    expect(error.name).toBe('ValidateCommandError')
    expect(error.reason).toBe('unknown-error')
    expect(error.exitCode).toBe(VALIDATE_EXIT_CODES.UNKNOWN_ERROR)
  })
})

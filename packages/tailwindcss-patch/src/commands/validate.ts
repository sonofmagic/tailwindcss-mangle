import type { RestoreConfigFilesResult } from './migration-types'

export const VALIDATE_EXIT_CODES = {
  OK: 0,
  REPORT_INCOMPATIBLE: 21,
  MISSING_BACKUPS: 22,
  IO_ERROR: 23,
  UNKNOWN_ERROR: 24,
} as const

export const VALIDATE_FAILURE_REASONS = [
  'report-incompatible',
  'missing-backups',
  'io-error',
  'unknown-error',
] as const

export type ValidateFailureReason = (typeof VALIDATE_FAILURE_REASONS)[number]

export interface ValidateFailureSummary {
  reason: ValidateFailureReason
  exitCode: number
  message: string
}

export interface ValidateJsonSuccessPayload extends RestoreConfigFilesResult {
  ok: true
}

export interface ValidateJsonFailurePayload {
  ok: false
  reason: ValidateFailureReason
  exitCode: number
  message: string
}

const IO_ERROR_CODES = new Set(['ENOENT', 'EACCES', 'EPERM', 'EISDIR', 'ENOTDIR', 'EMFILE', 'ENFILE'])

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return !!error && typeof error === 'object' && ('code' in error || 'message' in error)
}

export function classifyValidateError(error: unknown): ValidateFailureSummary {
  const message = error instanceof Error ? error.message : String(error)
  if (message.startsWith('Unsupported report kind') || message.startsWith('Unsupported report schema version')) {
    return {
      reason: 'report-incompatible',
      exitCode: VALIDATE_EXIT_CODES.REPORT_INCOMPATIBLE,
      message,
    }
  }
  if (message.startsWith('Restore failed:')) {
    return {
      reason: 'missing-backups',
      exitCode: VALIDATE_EXIT_CODES.MISSING_BACKUPS,
      message,
    }
  }
  if (isNodeError(error) && typeof error.code === 'string' && IO_ERROR_CODES.has(error.code)) {
    return {
      reason: 'io-error',
      exitCode: VALIDATE_EXIT_CODES.IO_ERROR,
      message,
    }
  }
  return {
    reason: 'unknown-error',
    exitCode: VALIDATE_EXIT_CODES.UNKNOWN_ERROR,
    message,
  }
}

export class ValidateCommandError extends Error {
  reason: ValidateFailureReason
  exitCode: number

  constructor(summary: ValidateFailureSummary, options?: ErrorOptions) {
    super(summary.message, options)
    this.name = 'ValidateCommandError'
    this.reason = summary.reason
    this.exitCode = summary.exitCode
  }
}

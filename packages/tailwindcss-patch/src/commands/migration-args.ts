import type { TailwindcssPatchCommandArgMap } from './types'

export interface ResolvedMigrateCommandArgs {
  include?: string[]
  exclude?: string[]
  maxDepth?: number
  checkMode: boolean
  dryRun: boolean
  hasInvalidMaxDepth: boolean
}

export interface ResolvedRestoreCommandArgs {
  reportFile: string
  dryRun: boolean
  strict: boolean
}

export interface ResolvedValidateCommandArgs {
  reportFile: string
  strict: boolean
}

export function normalizePatternArgs(value?: string | string[]) {
  if (!value) {
    return undefined
  }
  const raw = Array.isArray(value) ? value : [value]
  const values = raw
    .flatMap(item => item.split(','))
    .map(item => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : undefined
}

function parseMaxDepth(value: TailwindcssPatchCommandArgMap['migrate']['maxDepth']) {
  if (value === undefined) {
    return {
      maxDepth: undefined,
      hasInvalidMaxDepth: false,
    }
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      maxDepth: undefined,
      hasInvalidMaxDepth: true,
    }
  }
  return {
    maxDepth: Math.floor(parsed),
    hasInvalidMaxDepth: false,
  }
}

export function resolveMigrateCommandArgs(args: TailwindcssPatchCommandArgMap['migrate']): ResolvedMigrateCommandArgs {
  const include = normalizePatternArgs(args.include)
  const exclude = normalizePatternArgs(args.exclude)
  const { maxDepth, hasInvalidMaxDepth } = parseMaxDepth(args.maxDepth)
  const checkMode = args.check ?? false
  const dryRun = args.dryRun ?? checkMode

  return {
    include,
    exclude,
    maxDepth,
    checkMode,
    dryRun,
    hasInvalidMaxDepth,
  }
}

export function resolveRestoreCommandArgs(args: TailwindcssPatchCommandArgMap['restore']): ResolvedRestoreCommandArgs {
  return {
    reportFile: args.reportFile ?? '.tw-patch/migrate-report.json',
    dryRun: args.dryRun ?? false,
    strict: args.strict ?? false,
  }
}

export function resolveValidateCommandArgs(args: TailwindcssPatchCommandArgMap['validate']): ResolvedValidateCommandArgs {
  return {
    reportFile: args.reportFile ?? '.tw-patch/migrate-report.json',
    strict: args.strict ?? false,
  }
}

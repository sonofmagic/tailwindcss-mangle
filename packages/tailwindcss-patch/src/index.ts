import type { TailwindcssMangleConfig } from '@tailwindcss-mangle/config'

export { TailwindcssPatcher } from './api/tailwindcss-patcher'
export { CacheStore } from './cache/store'
export {
  createTailwindcssPatchCli,
  mountTailwindcssPatchCommands,
  type TailwindcssPatchCliMountOptions,
  type TailwindcssPatchCliOptions,
  type TailwindcssPatchCommand,
  type TailwindcssPatchCommandContext,
  type TailwindcssPatchCommandHandler,
  type TailwindcssPatchCommandHandlerMap,
  type TailwindcssPatchCommandOptionDefinition,
  type TailwindcssPatchCommandOptions,
  tailwindcssPatchCommands,
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
  type ValidateFailureReason,
  type ValidateFailureSummary,
  type ValidateJsonFailurePayload,
  type ValidateJsonSuccessPayload,
} from './commands/cli'
export {
  type ConfigFileMigrationEntry,
  type ConfigFileMigrationReport,
  migrateConfigFiles,
  type MigrateConfigFilesOptions,
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
  restoreConfigFiles,
  type RestoreConfigFilesOptions,
  type RestoreConfigFilesResult,
} from './commands/migrate-config'
export { normalizeOptions } from './config'
export type { TailwindCssPatchOptions } from './config'
export {
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  extractSourceCandidates,
  extractSourceCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
  resolveProjectSourceFiles,
  type ExtractSourceCandidate,
} from './extraction/candidate-extractor'
export {
  collectClassesFromContexts,
  collectClassesFromTailwindV4,
  getPatchStatusReport,
  loadRuntimeContexts,
  runTailwindBuild,
} from './install'
export { default as logger } from './logger'
export * from './types'
export {
  createTailwindV4Engine,
  loadTailwindV4DesignSystem,
  resolveTailwindV4Source,
  resolveTailwindV4SourceFromPatchOptions,
  resolveValidTailwindV4Candidates,
} from './v4'
export type {
  TailwindV4CandidateSource,
  TailwindV4CssSource,
  TailwindV4DesignSystem,
  TailwindV4Engine,
  TailwindV4GenerateOptions,
  TailwindV4GenerateResult,
  TailwindV4ResolvedSource,
  TailwindV4SourceOptions,
} from './v4'

export function defineConfig<T extends TailwindcssMangleConfig>(config: T): T {
  return config
}

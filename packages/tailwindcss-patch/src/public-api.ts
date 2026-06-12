import type { TailwindcssMangleConfig } from '@tailwindcss-mangle/config'

export { TailwindcssPatcher } from './api/tailwindcss-patcher'
export { CacheStore } from './cache/store'
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
export {
  type TailwindcssPatchCliMountOptions,
  type TailwindcssPatchCliOptions,
  type TailwindcssPatchCommand,
  type TailwindcssPatchCommandContext,
  type TailwindcssPatchCommandHandler,
  type TailwindcssPatchCommandHandlerMap,
  type TailwindcssPatchCommandOptionDefinition,
  type TailwindcssPatchCommandOptions,
  tailwindcssPatchCommands,
} from './commands/types'
export {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
  type ValidateFailureReason,
  type ValidateFailureSummary,
  type ValidateJsonFailurePayload,
  type ValidateJsonSuccessPayload,
} from './commands/validate'
export { normalizeOptions } from './config'
export type { TailwindCssPatchOptions } from './config'
export {
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  type ExtractSourceCandidate,
  extractSourceCandidates,
  extractSourceCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
  resolveProjectSourceFiles,
} from './extraction/candidate-extractor'
export {
  isValidCandidateToken,
  splitCandidateTokens,
  validateCandidateTokenRE,
} from './extraction/split-candidate-tokens'
export {
  collectClassesFromContexts,
  collectClassesFromTailwindV4,
  getPatchStatusReport,
  loadRuntimeContexts,
  runTailwindBuild,
} from './install'
export { default as logger } from './logger'
export {
  collectTailwindStyleCandidates,
} from './style-candidates'
export type {
  TailwindStyleCandidateOptions,
  TailwindStyleSource,
} from './style-candidates'
export {
  generateCustomStyle,
  generateTailwindStyle,
} from './style-generator'
export type {
  CustomTailwindStyleGenerateContext,
  CustomTailwindStyleGenerateOptions,
  CustomTailwindStyleGenerateResult,
  TailwindStyleGenerateOptions,
  TailwindStyleGenerateResult,
} from './style-generator'
export * from './types'
export {
  generateTailwindV3Style,
} from './v3'
export type {
  TailwindV3StyleGenerateOptions,
  TailwindV3StyleGenerateResult,
  TailwindV3StyleLayer,
} from './v3'
export {
  canonicalizeBareArbitraryValueCandidates,
  collectTailwindV4StyleCandidates,
  createTailwindV4CompiledSourceEntries,
  createTailwindV4DefaultIgnoreSources,
  createTailwindV4Engine,
  createTailwindV4RootSources,
  createTailwindV4SourceEntryMatcher,
  createTailwindV4SourceExclusionMatcher,
  escapeCssClassName,
  expandTailwindV4SourceEntries,
  expandTailwindV4SourceEntryBraces,
  extractBareArbitraryValueSourceCandidates,
  extractBareArbitraryValueSourceCandidatesWithPositions,
  generateTailwindV4Style,
  isBareArbitraryValuesEnabled,
  isFileExcludedByTailwindV4SourceEntries,
  isFileMatchedByTailwindV4SourceEntries,
  loadTailwindV4DesignSystem,
  mergeTailwindV4SourceEntries,
  normalizeTailwindV4ScannerSources,
  normalizeTailwindV4SourceEntries,
  replaceBareArbitraryValueSelectors,
  resolveBareArbitraryValueCandidate,
  resolveSourceScanPath,
  resolveTailwindV4Source,
  resolveTailwindV4SourceBaseCandidates,
  resolveTailwindV4SourceEntry,
  resolveTailwindV4SourceFromPatchOptions,
  resolveValidTailwindV4Candidates,
  TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN,
  TAILWIND_V4_IGNORED_CONTENT_DIRS,
  TAILWIND_V4_IGNORED_EXTENSIONS,
  TAILWIND_V4_IGNORED_FILES,
} from './v4'
export type {
  TailwindV4CandidateSource,
  TailwindV4CompiledSourceRoot,
  TailwindV4CssSource,
  TailwindV4DesignSystem,
  TailwindV4Engine,
  TailwindV4GenerateOptions,
  TailwindV4GenerateResult,
  TailwindV4ResolvedSource,
  TailwindV4SourceOptions,
  TailwindV4SourcePattern,
  TailwindV4StyleGenerateOptions,
  TailwindV4StyleGenerateResult,
  TailwindV4StyleSource,
} from './v4'

export function defineConfig<T extends TailwindcssMangleConfig>(config: T): T {
  return config
}

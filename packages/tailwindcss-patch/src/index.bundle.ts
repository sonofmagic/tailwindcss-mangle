import type { TailwindcssMangleConfig } from '@tailwindcss-mangle/config'
import type { CAC } from 'cac'
import type { TailwindcssPatchCliMountOptions, TailwindcssPatchCliOptions } from './commands/types'

import { createRequire } from 'node:module'
import { TailwindcssPatcher } from './api/tailwindcss-patcher'
import { CacheStore } from './cache/store'
import {
  migrateConfigFiles,
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
  restoreConfigFiles,
} from './commands/migrate-config'
import { tailwindcssPatchCommands } from './commands/types'
import {
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
} from './commands/validate'
import { normalizeOptions } from './config'
import {
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
} from './extraction/candidate-extractor'
import {
  collectClassesFromContexts,
  collectClassesFromTailwindV4,
  getPatchStatusReport,
  loadRuntimeContexts,
  runTailwindBuild,
} from './install'
import logger from './logger'

const require = createRequire(import.meta.url)

type CliModule = typeof import('./commands/cli')

function loadCliModule(): CliModule {
  return require('./commands/cli-runtime.js') as CliModule
}

export {
  CacheStore,
  collectClassesFromContexts,
  collectClassesFromTailwindV4,
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
  getPatchStatusReport,
  groupTokensByFile,
  loadRuntimeContexts,
  logger,
  migrateConfigFiles,
  MIGRATION_REPORT_KIND,
  MIGRATION_REPORT_SCHEMA_VERSION,
  normalizeOptions,
  restoreConfigFiles,
  runTailwindBuild,
  tailwindcssPatchCommands,
  TailwindcssPatcher,
  VALIDATE_EXIT_CODES,
  VALIDATE_FAILURE_REASONS,
  ValidateCommandError,
}
export type {
  ConfigFileMigrationEntry,
  ConfigFileMigrationReport,
  MigrateConfigFilesOptions,
  RestoreConfigFilesOptions,
  RestoreConfigFilesResult,
} from './commands/migrate-config'
export type {
  TailwindcssPatchCliMountOptions,
  TailwindcssPatchCliOptions,
  TailwindcssPatchCommand,
  TailwindcssPatchCommandContext,
  TailwindcssPatchCommandHandler,
  TailwindcssPatchCommandHandlerMap,
  TailwindcssPatchCommandOptionDefinition,
  TailwindcssPatchCommandOptions,
} from './commands/types'
export type {
  ValidateFailureReason,
  ValidateFailureSummary,
  ValidateJsonFailurePayload,
  ValidateJsonSuccessPayload,
} from './commands/validate'
export type { TailwindCssPatchOptions } from './config'
export * from './types'

export function mountTailwindcssPatchCommands(cli: CAC, options: TailwindcssPatchCliMountOptions = {}) {
  return loadCliModule().mountTailwindcssPatchCommands(cli, options)
}

export function createTailwindcssPatchCli(options: TailwindcssPatchCliOptions = {}) {
  return loadCliModule().createTailwindcssPatchCli(options)
}

export function defineConfig<T extends TailwindcssMangleConfig>(config: T): T {
  return config
}

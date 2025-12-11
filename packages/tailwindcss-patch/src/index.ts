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
} from './cli/commands'
export {
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
} from './extraction/candidate-extractor'
export { default as logger } from './logger'
export { normalizeOptions } from './options/normalize'
export { getPatchStatusReport } from './patching/status'
export { collectClassesFromContexts, collectClassesFromTailwindV4 } from './runtime/class-collector'
export { loadRuntimeContexts } from './runtime/context-registry'
export { runTailwindBuild } from './runtime/process-tailwindcss'
export * from './types'
export { defineConfig } from '@tailwindcss-mangle/config'

export { TailwindcssPatcher } from './api/tailwindcss-patcher'
export { CacheStore } from './cache/store'
export {
  extractRawCandidates,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
} from './extraction/candidate-extractor'
export { default as logger } from './logger'
export { normalizeOptions } from './options/normalize'
export { collectClassesFromContexts, collectClassesFromTailwindV4 } from './runtime/class-collector'
export { loadRuntimeContexts } from './runtime/context-registry'
export { runTailwindBuild } from './runtime/process-tailwindcss'
export * from './types'
export { defineConfig } from '@tailwindcss-mangle/config'

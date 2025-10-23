export { TailwindcssPatcher } from './api/tailwindcss-patcher'
export { normalizeOptions } from './options/normalize'
export { CacheStore } from './cache/store'
export {
  extractValidCandidates,
  extractRawCandidates,
  extractRawCandidatesWithPositions,
} from './extraction/candidate-extractor'
export { loadRuntimeContexts } from './runtime/context-registry'
export { collectClassesFromContexts, collectClassesFromTailwindV4 } from './runtime/class-collector'
export { runTailwindBuild } from './runtime/process-tailwindcss'
export { default as logger } from './logger'
export * from './types'
export { defineConfig } from '@tailwindcss-mangle/config'

export {
  canonicalizeBareArbitraryValueCandidates,
  extractTailwindV4InlineSourceCandidates,
  replaceBareArbitraryValueSelectors,
  resolveValidTailwindV4Candidates,
} from './candidates'
export {
  escapeCssClassName,
  extractBareArbitraryValueSourceCandidates,
  extractBareArbitraryValueSourceCandidatesWithPositions,
  isBareArbitraryValuesEnabled,
  resolveBareArbitraryValueCandidate,
} from './bare-arbitrary-values'
export { createTailwindV4Engine } from './engine'
export {
  compileTailwindV4Source,
  loadTailwindV4DesignSystem,
  loadTailwindV4NodeModule,
} from './node-adapter'
export {
  resolveTailwindV4Source,
  resolveTailwindV4SourceFromPatchOptions,
  tailwindV4SourceOptionsFromPatchOptions,
} from './source'
export {
  createTailwindV4CompiledSourceEntries,
  createTailwindV4DefaultIgnoreSources,
  createTailwindV4RootSources,
  createTailwindV4SourceEntryMatcher,
  createTailwindV4SourceExclusionMatcher,
  expandTailwindV4SourceEntries,
  expandTailwindV4SourceEntryBraces,
  isFileExcludedByTailwindV4SourceEntries,
  isFileMatchedByTailwindV4SourceEntries,
  mergeTailwindV4SourceEntries,
  normalizeTailwindV4ScannerSources,
  normalizeTailwindV4SourceEntries,
  resolveSourceScanPath,
  resolveTailwindV4SourceBaseCandidates,
  resolveTailwindV4SourceEntry,
  TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN,
  TAILWIND_V4_IGNORED_CONTENT_DIRS,
  TAILWIND_V4_IGNORED_EXTENSIONS,
  TAILWIND_V4_IGNORED_FILES,
} from './source-scan'
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
} from './types'

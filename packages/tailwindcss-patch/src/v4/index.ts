import type {
  TailwindV4ResolvedSource,
  TailwindV4SourceOptions,
} from '@tailwindcss-mangle/engine/v4'
import type {
  NormalizedTailwindCssPatchOptions,
  TailwindCssPatchOptions,
} from '../config'
import { resolveTailwindV4Source } from '@tailwindcss-mangle/engine/v4'
import path from 'pathe'
import { normalizeOptions } from '../config'

export {
  canonicalizeBareArbitraryValueCandidates,
  collectTailwindV4StyleCandidates,
  compileTailwindV4Source,
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
  extractTailwindV4InlineSourceCandidates,
  generateTailwindV4Style,
  getTailwindV4DesignSystemCacheKey,
  groupTailwindV4SourceEntriesByBase,
  isBareArbitraryValuesEnabled,
  isFileExcludedByTailwindV4SourceEntries,
  isFileMatchedByTailwindV4SourceEntries,
  loadTailwindV4DesignSystem,
  loadTailwindV4NodeModule,
  mergeTailwindV4SourceEntries,
  normalizeGlobPattern,
  normalizeTailwindV4ScannerSources,
  normalizeTailwindV4SourceEntries,
  replaceBareArbitraryValueSelectors,
  resolveBareArbitraryValueCandidate,
  resolveSourceScanPath,
  resolveTailwindV4Source,
  resolveTailwindV4SourceBaseCandidates,
  resolveTailwindV4SourceEntry,
  resolveValidTailwindV4Candidates,
  TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN,
  TAILWIND_V4_IGNORED_CONTENT_DIRS,
  TAILWIND_V4_IGNORED_EXTENSIONS,
  TAILWIND_V4_IGNORED_FILES,
  toPosixPath,
} from '@tailwindcss-mangle/engine/v4'
export type {
  BareArbitraryValueOptions,
  BareArbitraryValueResolveResult,
  BareArbitraryValueSourceCandidate,
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
} from '@tailwindcss-mangle/engine/v4'

function uniquePaths(values: Iterable<string | undefined>) {
  const result: string[] = []
  for (const value of values) {
    if (!value) {
      continue
    }
    const resolved = path.resolve(value)
    if (!result.includes(resolved)) {
      result.push(resolved)
    }
  }
  return result
}

function resolveConfigDir(config: string | undefined, projectRoot: string) {
  if (!config) {
    return undefined
  }
  const configPath = path.isAbsolute(config)
    ? config
    : path.resolve(projectRoot, config)
  return path.dirname(configPath)
}

function createSourceOptionsFromNormalizedPatchOptions(
  options: NormalizedTailwindCssPatchOptions,
): TailwindV4SourceOptions {
  const v4 = options.tailwind.v4
  const configDir = resolveConfigDir(
    options.tailwind.config,
    options.projectRoot,
  )
  const baseFallbacks = uniquePaths([
    v4?.configuredBase,
    options.tailwind.cwd,
    options.projectRoot,
    configDir,
  ])

  return {
    projectRoot: options.projectRoot,
    ...(options.tailwind.cwd === undefined
      ? {}
      : { cwd: options.tailwind.cwd }),
    ...(v4?.configuredBase === undefined ? {} : { base: v4.configuredBase }),
    baseFallbacks,
    ...(v4?.css === undefined ? {} : { css: v4.css }),
    ...(v4?.cssSources === undefined ? {} : { cssSources: v4.cssSources }),
    ...(v4?.cssEntries === undefined ? {} : { cssEntries: v4.cssEntries }),
    packageName: options.tailwind.packageName,
  }
}

export function tailwindV4SourceOptionsFromPatchOptions(
  options: TailwindCssPatchOptions,
): TailwindV4SourceOptions {
  return createSourceOptionsFromNormalizedPatchOptions(
    normalizeOptions(options),
  )
}

export async function resolveTailwindV4SourceFromPatchOptions(
  options: TailwindCssPatchOptions,
): Promise<TailwindV4ResolvedSource> {
  return resolveTailwindV4Source(
    tailwindV4SourceOptionsFromPatchOptions(options),
  )
}

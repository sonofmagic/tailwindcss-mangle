import type {
  TailwindV4Engine,
  TailwindV4GenerateOptions,
  TailwindV4GenerateResult,
  TailwindV4ResolvedSource,
  TailwindV4SourcePattern,
} from './types.ts'
import { extractRawCandidates, extractRawCandidatesWithPositions } from '../extraction/candidate-extractor.ts'
import {
  canonicalizeBareArbitraryValueCandidates,
  extractTailwindV4InlineSourceCandidates,
  replaceBareArbitraryValueSelectors,
  resolveValidTailwindV4Candidates,
} from './candidates.ts'
import { compileTailwindV4Source, loadTailwindV4DesignSystem } from './node-adapter.ts'
import { createTailwindV4CompiledSourceEntries } from './source-scan.ts'

function resolveScanSources(
  options: TailwindV4GenerateOptions | undefined,
  source: TailwindV4ResolvedSource,
  compiledRoot: TailwindV4GenerateResult['root'],
  compiledSources: TailwindV4SourcePattern[],
) {
  if (Array.isArray(options?.scanSources)) {
    return options.scanSources
  }
  if (options?.scanSources === true) {
    return createTailwindV4CompiledSourceEntries(compiledRoot, compiledSources, source.base)
  }
  return []
}

async function collectRawCandidates(
  source: TailwindV4ResolvedSource,
  options: TailwindV4GenerateOptions | undefined,
  compiledRoot: TailwindV4GenerateResult['root'],
  compiledSources: TailwindV4SourcePattern[] = [],
) {
  const rawCandidates = new Set<string>()
  const extractOptions = options?.bareArbitraryValues === undefined
    ? undefined
    : { bareArbitraryValues: options.bareArbitraryValues }

  for (const candidate of options?.candidates ?? []) {
    rawCandidates.add(candidate)
  }

  for (const candidateSource of options?.sources ?? []) {
    const candidates = await extractRawCandidatesWithPositions(candidateSource.content, candidateSource.extension, extractOptions)
    for (const candidate of candidates) {
      rawCandidates.add(candidate.rawCandidate)
    }
  }

  const filesystemSources = resolveScanSources(options, source, compiledRoot, compiledSources)
  if (filesystemSources.length > 0) {
    for (const candidate of await extractRawCandidates(filesystemSources, extractOptions)) {
      rawCandidates.add(candidate)
    }
  }

  const inlineSources = extractTailwindV4InlineSourceCandidates(source.css)
  for (const candidate of inlineSources.included) {
    rawCandidates.add(candidate)
  }
  for (const candidate of inlineSources.excluded) {
    rawCandidates.delete(candidate)
  }

  return rawCandidates
}

export function createTailwindV4Engine(source: TailwindV4ResolvedSource): TailwindV4Engine {
  return {
    source,
    loadDesignSystem() {
      return loadTailwindV4DesignSystem(source)
    },
    async validateCandidates(candidates) {
      const designSystem = await loadTailwindV4DesignSystem(source)
      return resolveValidTailwindV4Candidates(designSystem, candidates)
    },
    async generate(options): Promise<TailwindV4GenerateResult> {
      const { compiled, dependencies } = await compileTailwindV4Source(source)
      const rawCandidates = await collectRawCandidates(source, options, compiled.root, compiled.sources)
      const designSystem = await loadTailwindV4DesignSystem(source)
      const classSet = resolveValidTailwindV4Candidates(designSystem, rawCandidates, {
        ...(options?.bareArbitraryValues === undefined ? {} : { bareArbitraryValues: options.bareArbitraryValues }),
      })
      const inlineSources = extractTailwindV4InlineSourceCandidates(source.css)
      for (const candidate of inlineSources.excluded) {
        classSet.delete(candidate)
      }

      const buildCandidates = canonicalizeBareArbitraryValueCandidates(classSet, options?.bareArbitraryValues)
      const css = replaceBareArbitraryValueSelectors(
        compiled.build(buildCandidates),
        classSet,
        options?.bareArbitraryValues,
      )

      return {
        css,
        classSet,
        rawCandidates,
        dependencies: Array.from(dependencies),
        sources: compiled.sources,
        root: compiled.root,
      }
    },
  }
}

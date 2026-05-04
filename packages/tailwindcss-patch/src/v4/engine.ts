import type {
  TailwindV4Engine,
  TailwindV4GenerateOptions,
  TailwindV4GenerateResult,
  TailwindV4ResolvedSource,
} from './types'
import { extractRawCandidatesWithPositions } from '../extraction/candidate-extractor'
import { extractTailwindV4InlineSourceCandidates, resolveValidTailwindV4Candidates } from './candidates'
import { compileTailwindV4Source, loadTailwindV4DesignSystem } from './node-adapter'

async function collectRawCandidates(source: TailwindV4ResolvedSource, options: TailwindV4GenerateOptions | undefined) {
  const rawCandidates = new Set<string>()

  for (const candidate of options?.candidates ?? []) {
    rawCandidates.add(candidate)
  }

  for (const candidateSource of options?.sources ?? []) {
    const candidates = await extractRawCandidatesWithPositions(candidateSource.content, candidateSource.extension)
    for (const candidate of candidates) {
      rawCandidates.add(candidate.rawCandidate)
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
      const rawCandidates = await collectRawCandidates(source, options)
      const designSystem = await loadTailwindV4DesignSystem(source)
      const classSet = resolveValidTailwindV4Candidates(designSystem, rawCandidates)
      const inlineSources = extractTailwindV4InlineSourceCandidates(source.css)
      // TODO: Non-inline `@source not "..."` is surfaced through `compiled.sources`;
      // apply it here if generate() grows filesystem SourceEntry scanning.
      for (const candidate of inlineSources.excluded) {
        classSet.delete(candidate)
      }

      const { compiled, dependencies } = await compileTailwindV4Source(source)
      const css = compiled.build(Array.from(classSet))

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

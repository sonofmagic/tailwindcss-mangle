import type { BareArbitraryValueOptions } from './v4/bare-arbitrary-values.ts'
import { extractSourceCandidates } from './extraction/candidate-extractor.ts'

export interface TailwindStyleSource {
  content: string
  extension?: string
  file?: string
}

export interface TailwindStyleCandidateOptions {
  candidates?: Iterable<string>
  sources?: TailwindStyleSource[]
  /**
   * Enables UnoCSS-style bare arbitrary values such as `p-10%` and `p-2.5px`.
   */
  bareArbitraryValues?: boolean | BareArbitraryValueOptions
}

export async function collectTailwindStyleCandidates(
  options: TailwindStyleCandidateOptions = {},
): Promise<Set<string>> {
  const candidates = new Set<string>()
  for (const candidate of options.candidates ?? []) {
    candidates.add(candidate)
  }
  for (const source of options.sources ?? []) {
    const sourceCandidates = await extractSourceCandidates(source.content, source.extension, {
      bareArbitraryValues: options.bareArbitraryValues,
    })
    for (const candidate of sourceCandidates) {
      candidates.add(candidate)
    }
  }
  return candidates
}

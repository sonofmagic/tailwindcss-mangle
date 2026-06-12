import type {
  TailwindV4SourceOptions,
  TailwindV4StyleGenerateOptions,
  TailwindV4StyleGenerateResult,
} from './types'
import { collectTailwindStyleCandidates } from '../style-candidates'
import { createTailwindV4Engine } from './engine'
import { resolveTailwindV4Source } from './source'

function createSourceOptions(options: TailwindV4StyleGenerateOptions): TailwindV4SourceOptions {
  return {
    ...(options.projectRoot === undefined ? {} : { projectRoot: options.projectRoot }),
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.base === undefined ? {} : { base: options.base }),
    ...(options.baseFallbacks === undefined ? {} : { baseFallbacks: options.baseFallbacks }),
    ...(options.css === undefined ? {} : { css: options.css }),
    ...(options.cssSources === undefined ? {} : { cssSources: options.cssSources }),
    ...(options.cssEntries === undefined ? {} : { cssEntries: options.cssEntries }),
    ...(options.packageName === undefined ? {} : { packageName: options.packageName }),
  }
}

export async function collectTailwindV4StyleCandidates(
  options: Pick<TailwindV4StyleGenerateOptions, 'bareArbitraryValues' | 'candidates' | 'sources'>,
): Promise<Set<string>> {
  return collectTailwindStyleCandidates(options)
}

export async function generateTailwindV4Style(
  options: TailwindV4StyleGenerateOptions = {},
): Promise<TailwindV4StyleGenerateResult> {
  const source = options.source ?? await resolveTailwindV4Source(createSourceOptions(options))
  const candidates = await collectTailwindV4StyleCandidates(options)
  const result = await createTailwindV4Engine(source).generate({
    candidates,
    ...(options.bareArbitraryValues === undefined ? {} : { bareArbitraryValues: options.bareArbitraryValues }),
    ...(options.scanSources === undefined ? {} : { scanSources: options.scanSources }),
  })
  return {
    ...result,
    tokens: result.rawCandidates,
    source,
  }
}

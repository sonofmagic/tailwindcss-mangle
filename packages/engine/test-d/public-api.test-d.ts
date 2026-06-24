import { expectAssignable, expectType } from 'tsd'
import { Parser } from '../dist/htmlparser2'
import {
  collectTailwindStyleCandidates,
  createTailwindV4Engine,
  extractSourceCandidates,
  extractSourceCandidatesWithPositions,
  generateTailwindStyle,
  generateTailwindV3RawStyle,
  generateTailwindV4Style,
  resolveTailwindV4Source,
  splitCandidateTokens,
  type TailwindStyleGenerateResult,
  type TailwindV4GenerateResult,
} from '../dist/index'

expectAssignable<typeof Parser>(Parser)
expectType<string[]>(splitCandidateTokens('text-red-500'))
expectType<Promise<string[]>>(extractSourceCandidates('<div class="text-red-500"></div>', 'html'))
expectType<Promise<Array<{ rawCandidate: string, start: number, end: number }>>>(
  extractSourceCandidatesWithPositions('<div class="text-red-500"></div>', 'html'),
)
expectType<Promise<Set<string>>>(collectTailwindStyleCandidates({
  candidates: ['text-red-500'],
}))

expectAssignable<Promise<TailwindStyleGenerateResult>>(generateTailwindStyle({
  version: 4,
  css: '@import "tailwindcss";',
  candidates: ['text-red-500'],
}))

expectType<Promise<TailwindV4GenerateResult>>(createTailwindV4Engine({
  projectRoot: process.cwd(),
  base: process.cwd(),
  baseFallbacks: [],
  css: '@import "tailwindcss";',
  dependencies: [],
}).generate({
  candidates: ['text-red-500'],
}))

expectAssignable<Promise<{ css: string, classSet: Set<string> }>>(generateTailwindV3RawStyle({
  candidates: ['text-red-500'],
}))
expectAssignable<Promise<{ source: Awaited<ReturnType<typeof resolveTailwindV4Source>> }>>(generateTailwindV4Style({
  css: '@import "tailwindcss";',
}))

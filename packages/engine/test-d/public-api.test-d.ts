import { expectAssignable, expectType } from 'tsd'
import { Parser } from '../dist/htmlparser2.js'
import {
  collectTailwindStyleCandidates,
  createTailwindGenerationSession,
  createTailwindV4Engine,
  extractSourceCandidates,
  extractSourceCandidatesWithPositions,
  generateTailwindStyle,
  generateTailwindV3RawStyle,
  generateTailwindV4Style,
  resolveTailwindV4Source,
  splitCandidateTokens,
  type TailwindStyleGenerateResult,
  type TailwindGenerationArtifact,
  type TailwindGenerationSession,
  type TailwindV4GenerateResult,
} from '../dist/index.js'

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

const generationSession = createTailwindGenerationSession({
  projectRoot: process.cwd(),
  base: process.cwd(),
  baseFallbacks: [],
  css: '@import "tailwindcss";',
  dependencies: [],
})
expectAssignable<TailwindGenerationSession>(generationSession)
expectType<Promise<TailwindGenerationArtifact>>(generationSession.generate({
  candidates: ['text-red-500'],
  sourceEntries: [{
    id: 'virtual:page.html',
    extension: 'html',
    content: '<div class="bg-blue-500"></div>',
  }],
}))

expectAssignable<Promise<{ css: string, classSet: Set<string> }>>(generateTailwindV3RawStyle({
  candidates: ['text-red-500'],
}))
expectAssignable<Promise<{ source: Awaited<ReturnType<typeof resolveTailwindV4Source>> }>>(generateTailwindV4Style({
  css: '@import "tailwindcss";',
}))

import type { SourceEntry } from '@tailwindcss/oxide'
import process from 'node:process'
import { defuOverrideArray } from '@tailwindcss-mangle/shared'

async function importNode() {
  return import('@tailwindcss/node')
}

async function importOxide() {
  return import('@tailwindcss/oxide')
}

export interface ExtractValidCandidatesOption {
  sources?: SourceEntry[]
  base?: string
  css?: string
  cwd?: string
}

export async function extractRawCandidatesWithPositions(
  content: string,
  extension: string = 'html',
): Promise<{ rawCandidate: string, start: number, end: number }[]> {
  const { Scanner } = await importOxide()
  const scanner = new Scanner({})
  const result = scanner.getCandidatesWithPositions({ content, extension })

  return result.map(({ candidate, position }) => ({
    rawCandidate: candidate,
    start: position,
    end: position + candidate.length,
  }))
}

export async function extractRawCandidates(
  sources?: SourceEntry[],
): Promise<string[]> {
  const { Scanner } = await importOxide()
  const scanner = new Scanner({
    sources,
  })

  return scanner.scan()
}

export async function extractValidCandidates(options?: ExtractValidCandidatesOption) {
  const defaultCwd = options?.cwd ?? process.cwd()
  const { sources, base, css } = defuOverrideArray<
    Required<ExtractValidCandidatesOption>,
    Partial<ExtractValidCandidatesOption>[]
  >(
    options,
    {
      css: '@import "tailwindcss";',
      base: defaultCwd,
      sources: [
        {
          base: defaultCwd,
          pattern: '**/*',
          negated: false,
        },
      ],
    },
  )

  const { __unstable__loadDesignSystem } = await importNode()
  const designSystem = await __unstable__loadDesignSystem(css, { base })

  const candidates = await extractRawCandidates(sources)
  const validCandidates = candidates.filter(
    rawCandidate => designSystem.parseCandidate(rawCandidate).length > 0,
  )
  return validCandidates
}

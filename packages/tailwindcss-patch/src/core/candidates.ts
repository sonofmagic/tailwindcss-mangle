import type { SourceEntry } from '@tailwindcss/oxide'
import process from 'node:process'
import { defuOverrideArray } from '@tailwindcss-mangle/shared'

function importNode() {
  return import('@tailwindcss/node')
}

function importOxide() {
  return import('@tailwindcss/oxide')
}

export async function extractRawCandidatesWithPositions(
  content: string,
  extension: string = 'html',
): Promise<{ rawCandidate: string, start: number, end: number }[]> {
  const { Scanner } = await importOxide()
  const scanner = new Scanner({})

  const result = scanner.getCandidatesWithPositions({ content, extension })

  const candidates: { rawCandidate: string, start: number, end: number }[] = []
  for (const { candidate: rawCandidate, position: start } of result) {
    candidates.push({ rawCandidate, start, end: start + rawCandidate.length })
  }
  return candidates
}

export async function extractRawCandidates(
  sources?: SourceEntry[],
): Promise<string[]> {
  const { Scanner } = await importOxide()
  const scanner = new Scanner({
    sources,
  })

  const candidates = scanner.scan()

  return candidates
}

export interface ExtractValidCandidatesOption {
  sources?: SourceEntry[]
  base?: string
  css?: string
  cwd?: string
}

export async function extractValidCandidates(options?: ExtractValidCandidatesOption) {
  const defaultCwd = options?.cwd ?? process.cwd()
  const { sources, base, css } = defuOverrideArray<
    Required<ExtractValidCandidatesOption>,
    Partial<ExtractValidCandidatesOption>[]
  >(
    // @ts-ignore
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

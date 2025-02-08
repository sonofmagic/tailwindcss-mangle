import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'
import { __unstable__loadDesignSystem } from '@tailwindcss/node'
import { Scanner } from '@tailwindcss/oxide'

export async function extractRawCandidates(
  content: string,
  extension: string = 'html',
): Promise<{ rawCandidate: string, start: number, end: number }[]> {
  const scanner = new Scanner({})

  const result = scanner.getCandidatesWithPositions({ content, extension })

  const candidates: { rawCandidate: string, start: number, end: number }[] = []
  for (const { candidate: rawCandidate, position: start } of result) {
    candidates.push({ rawCandidate, start, end: start + rawCandidate.length })
  }
  return candidates
}

export interface ExtractValidCandidatesOption {
  content: string
  base?: string
  css?: string
}

export async function extractValidCandidates(options: ExtractValidCandidatesOption) {
  const { content, base, css } = defu<
    Required<ExtractValidCandidatesOption>,
    Partial<ExtractValidCandidatesOption>[]
  >(options, {
    css: '@import "tailwindcss";',
    base: process.cwd(),
  })
  const designSystem = await __unstable__loadDesignSystem(css, { base })

  const candidates = await extractRawCandidates(content)
  const validCandidates = candidates.filter(
    ({ rawCandidate }) => designSystem.parseCandidate(rawCandidate).length > 0,
  )
  return validCandidates
}

import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'

function importNode() {
  return import('@tailwindcss/node')
}

function importOxide() {
  return import('@tailwindcss/oxide')
}

export async function extractRawCandidates(
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
  const { __unstable__loadDesignSystem } = await importNode()
  const designSystem = await __unstable__loadDesignSystem(css, { base })

  const candidates = await extractRawCandidates(content)
  const validCandidates = candidates.filter(
    ({ rawCandidate }) => designSystem.parseCandidate(rawCandidate).length > 0,
  )
  return validCandidates
}

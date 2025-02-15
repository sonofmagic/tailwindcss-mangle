import type { GlobEntry } from '@tailwindcss/oxide'
import process from 'node:process'
import { defu } from '@tailwindcss-mangle/shared'

function importNode() {
  return import('@tailwindcss/node')
}

function importOxide() {
  return import('@tailwindcss/oxide')
}

// function importTailwindcss() {
//   return import('tailwindcss')
// }

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
  sources?: GlobEntry[],
): Promise<string[]> {
  const { Scanner } = await importOxide()
  const scanner = new Scanner({
    sources,
  })

  const candidates = scanner.scan()

  return candidates
}

export interface ExtractValidCandidatesOption {
  content?: string
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
    content: '**/*',
  })

  // const { __unstable__loadDesignSystem } = await importTailwindcss()
  const { __unstable__loadDesignSystem } = await importNode()
  const designSystem = await __unstable__loadDesignSystem(css, { base })

  const candidates = await extractRawCandidates([
    {
      base,
      pattern: content,
    },
  ])
  const validCandidates = candidates.filter(
    rawCandidate => designSystem.parseCandidate(rawCandidate).length > 0,
  )
  return validCandidates
}

import type { SourceEntry } from '@tailwindcss/oxide'
import type {
  TailwindTokenByFileMap,
  TailwindTokenFileKey,
  TailwindTokenLocation,
  TailwindTokenReport,
} from '../types'
import { promises as fs } from 'node:fs'
import process from 'node:process'
import path from 'pathe'

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
  const providedOptions = options ?? {}
  const defaultCwd = providedOptions.cwd ?? process.cwd()

  const base = providedOptions.base ?? defaultCwd
  const css = providedOptions.css ?? '@import "tailwindcss";'
  const sources = (providedOptions.sources ?? [
    {
      base: defaultCwd,
      pattern: '**/*',
      negated: false,
    },
  ]).map(source => ({
    base: source.base ?? defaultCwd,
    pattern: source.pattern,
    negated: source.negated,
  }))

  const { __unstable__loadDesignSystem } = await importNode()
  const designSystem = await __unstable__loadDesignSystem(css, { base })

  const candidates = await extractRawCandidates(sources)
  const validCandidates = candidates.filter(
    rawCandidate => designSystem.parseCandidate(rawCandidate).length > 0,
  )
  return validCandidates
}

function normalizeSources(sources: SourceEntry[] | undefined, cwd: string) {
  const baseSources = sources?.length
    ? sources
    : [
        {
          base: cwd,
          pattern: '**/*',
          negated: false,
        },
      ]

  return baseSources.map(source => ({
    base: source.base ?? cwd,
    pattern: source.pattern,
    negated: source.negated,
  }))
}

function buildLineOffsets(content: string) {
  const offsets: number[] = [0]
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1)
    }
  }
  // Push a sentinel to simplify bounds checks during binary search.
  if (offsets[offsets.length - 1] !== content.length) {
    offsets.push(content.length)
  }
  return offsets
}

function resolveLineMeta(content: string, offsets: number[], index: number) {
  let low = 0
  let high = offsets.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const start = offsets[mid]
    const nextStart = offsets[mid + 1] ?? content.length

    if (index < start) {
      high = mid - 1
      continue
    }

    if (index >= nextStart) {
      low = mid + 1
      continue
    }

    const line = mid + 1
    const column = index - start + 1
    const lineEnd = content.indexOf('\n', start)
    const lineText = content.slice(start, lineEnd === -1 ? content.length : lineEnd)

    return { line, column, lineText }
  }

  const lastStart = offsets[offsets.length - 2] ?? 0
  return {
    line: offsets.length - 1,
    column: index - lastStart + 1,
    lineText: content.slice(lastStart),
  }
}

function toExtension(filename: string) {
  const ext = path.extname(filename).replace(/^\./, '')
  return ext || 'txt'
}

function toRelativeFile(cwd: string, filename: string) {
  const relative = path.relative(cwd, filename)
  return relative === '' ? path.basename(filename) : relative
}

export interface ExtractProjectCandidatesOptions {
  cwd?: string
  sources?: SourceEntry[]
}

export async function extractProjectCandidatesWithPositions(
  options?: ExtractProjectCandidatesOptions,
): Promise<TailwindTokenReport> {
  const cwd = options?.cwd ? path.resolve(options.cwd) : process.cwd()
  const normalizedSources = normalizeSources(options?.sources, cwd)
  const { Scanner } = await importOxide()
  const scanner = new Scanner({
    sources: normalizedSources,
  })

  const files = scanner.files ?? []
  const entries: TailwindTokenLocation[] = []
  const skipped: TailwindTokenReport['skippedFiles'] = []

  for (const file of files) {
    let content: string
    try {
      content = await fs.readFile(file, 'utf8')
    }
    catch (error) {
      skipped.push({
        file,
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
      continue
    }

    const extension = toExtension(file)
    const matches = scanner.getCandidatesWithPositions({
      file,
      content,
      extension,
    })

    if (!matches.length) {
      continue
    }

    const offsets = buildLineOffsets(content)
    const relativeFile = toRelativeFile(cwd, file)

    for (const match of matches) {
      const info = resolveLineMeta(content, offsets, match.position)
      entries.push({
        rawCandidate: match.candidate,
        file,
        relativeFile,
        extension,
        start: match.position,
        end: match.position + match.candidate.length,
        length: match.candidate.length,
        line: info.line,
        column: info.column,
        lineText: info.lineText,
      })
    }
  }

  return {
    entries,
    filesScanned: files.length,
    skippedFiles: skipped,
    sources: normalizedSources,
  }
}

export function groupTokensByFile(
  report: TailwindTokenReport,
  options?: { key?: TailwindTokenFileKey, stripAbsolutePaths?: boolean },
): TailwindTokenByFileMap {
  const key = options?.key ?? 'relative'
  const stripAbsolute = options?.stripAbsolutePaths ?? key !== 'absolute'

  return report.entries.reduce<TailwindTokenByFileMap>((acc, entry) => {
    const bucketKey = key === 'absolute' ? entry.file : entry.relativeFile
    if (!acc[bucketKey]) {
      acc[bucketKey] = []
    }
    const value = stripAbsolute
      ? {
          ...entry,
          file: entry.relativeFile,
        }
      : entry
    acc[bucketKey].push(value)
    return acc
  }, {})
}

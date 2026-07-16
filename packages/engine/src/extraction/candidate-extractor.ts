import type { SourceEntry } from '@tailwindcss/oxide'
import type {
  TailwindTokenByFileMap,
  TailwindTokenFileKey,
  TailwindTokenLocation,
  TailwindTokenReport,
} from '../types.ts'
import type { BareArbitraryValueOptions } from '../v4/bare-arbitrary-values.ts'
import type {
  ExtractCandidateOptions,
  ExtractSourceCandidate,
  ExtractSourceCandidateWithContext,
  JsStringStaticRange,
} from './types.ts'
import { promises as fs } from 'node:fs'
import process from 'node:process'
import path from 'pathe'
import {
  extractBareArbitraryValueSourceCandidatesWithPositions,
  resolveBareArbitraryValueCandidate,
} from '../v4/bare-arbitrary-values.ts'
import { extractTailwindV4InlineSourceCandidates, resolveValidTailwindV4Candidates } from '../v4/candidates.ts'
import { compileTailwindV4Source, getTailwindV4DesignSystemCacheKey, loadTailwindV4DesignSystem } from '../v4/node-adapter.ts'
import {
  createTailwindV4CompiledSourceEntries,
  normalizeTailwindV4ScannerSources,
} from '../v4/source-scan.ts'
import { extractCssApplyCandidates } from './css.ts'
import { createJsStringStaticRanges } from './js-string-ranges.ts'
import { getOxideModule } from './oxide.ts'
import {
  buildLineOffsets,
  createTokenLocation,
  toExtension,
} from './project-report.ts'
import {
  createRawCandidateCacheKey,
  createRawCandidateFileFingerprint,
  getRawCandidateCacheEntry,
  setRawCandidateCacheEntry,
} from './raw-candidate-cache.ts'
import {
  extractMixedSourceScriptCandidates,
  extractVueLikeSourceCandidates,
} from './sfc.ts'
import {
  createLocalCandidate,
  CSS_LIKE_SOURCE_EXTENSION_RE,
  dedupeCandidatesWithPositions,
  JS_LIKE_SOURCE_EXTENSION_RE,
  MIXED_TEMPLATE_SOURCE_EXTENSION_RE,
  shouldKeepSourceCandidate,
  VUE_LIKE_SOURCE_EXTENSION_RE,
} from './source-filters.ts'

const designSystemCandidateCache = new Map<string, Map<string, boolean>>()

export type {
  ExtractCandidateOptions,
  ExtractSourceCandidate,
} from './types.ts'

export interface ExtractValidCandidatesOption {
  sources?: SourceEntry[]
  base?: string
  baseFallbacks?: string[]
  css?: string
  cwd?: string
  bareArbitraryValues?: boolean | BareArbitraryValueOptions
}

function createCandidateCacheKey(
  designSystemKey: string,
  options: Pick<ExtractValidCandidatesOption, 'bareArbitraryValues'>,
) {
  if (options.bareArbitraryValues == null || options.bareArbitraryValues === false) {
    return designSystemKey
  }
  return `${designSystemKey}:bare-arbitrary:${JSON.stringify(options.bareArbitraryValues)}`
}

export async function extractRawCandidatesWithPositions(
  content: string,
  extension: string = 'html',
  options?: ExtractCandidateOptions,
): Promise<ExtractSourceCandidate[]> {
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner({})
  const result = scanner.getCandidatesWithPositions({ content, extension })

  const candidates = result.map(({ candidate, position }) => ({
    rawCandidate: candidate,
    start: position,
    end: position + candidate.length,
  }))
  candidates.push(...extractBareArbitraryValueSourceCandidatesWithPositions(content, options?.bareArbitraryValues))
  return dedupeCandidatesWithPositions(candidates)
}

export async function extractSourceCandidatesWithPositions(
  content: string,
  extension: string = 'html',
  options?: ExtractCandidateOptions,
): Promise<ExtractSourceCandidate[]> {
  const normalizedExtension = extension.replace(/^\./, '')
  const candidates: ExtractSourceCandidateWithContext[] = VUE_LIKE_SOURCE_EXTENSION_RE.test(normalizedExtension)
    ? await extractVueLikeSourceCandidates(content, extractRawCandidatesWithPositions, options)
    : CSS_LIKE_SOURCE_EXTENSION_RE.test(normalizedExtension)
      ? await extractCssApplyCandidates(content, normalizedExtension, extractRawCandidatesWithPositions, options)
      : (await extractRawCandidatesWithPositions(content, normalizedExtension, options))
          .map(candidate => ({
            ...candidate,
            content,
            extension: normalizedExtension,
            localStart: candidate.start,
          }))
  if (
    !VUE_LIKE_SOURCE_EXTENSION_RE.test(normalizedExtension)
    && MIXED_TEMPLATE_SOURCE_EXTENSION_RE.test(normalizedExtension)
  ) {
    candidates.push(...await extractMixedSourceScriptCandidates(content, extractRawCandidatesWithPositions, options))
  }
  const jsStringStaticRangesByContent = new Map<string, JsStringStaticRange[]>()
  function getJsStringStaticRanges(candidate: ExtractSourceCandidateWithContext) {
    if (!JS_LIKE_SOURCE_EXTENSION_RE.test(candidate.extension)) {
      return undefined
    }
    const cached = jsStringStaticRangesByContent.get(candidate.content)
    if (cached) {
      return cached
    }
    const ranges = createJsStringStaticRanges(candidate.content)
    jsStringStaticRangesByContent.set(candidate.content, ranges)
    return ranges
  }
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (!shouldKeepSourceCandidate(
      candidate.content,
      candidate.extension,
      createLocalCandidate(candidate),
      getJsStringStaticRanges(candidate),
      candidate.skipHtmlContextChecks,
    )) {
      return false
    }
    const key = `${candidate.start}:${candidate.end}:${candidate.rawCandidate}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  }).map(({ rawCandidate, start, end }) => ({ rawCandidate, start, end }))
}

export async function extractSourceCandidates(
  content: string,
  extension: string = 'html',
  options?: ExtractCandidateOptions,
): Promise<string[]> {
  const candidates = await extractSourceCandidatesWithPositions(content, extension, options)
  return [...new Set(candidates.map(candidate => candidate.rawCandidate))]
}

export async function extractRawCandidates(
  sources?: SourceEntry[],
  options?: ExtractCandidateOptions,
): Promise<string[]> {
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner(sources === undefined ? {} : { sources })
  const files = scanner.files ?? []
  const cacheKey = createRawCandidateCacheKey(sources, options)
  const fingerprint = await createRawCandidateFileFingerprint(files)
  const cached = getRawCandidateCacheEntry(cacheKey, fingerprint)
  if (cached) {
    return [...cached.candidates]
  }

  const scannedCandidates = scanner.scan()
  if (scannedCandidates.length === 0 && files.length > 0) {
    const changedContents = (await Promise.all(files.map(async (file) => {
      try {
        return {
          content: await fs.readFile(file, 'utf8'),
          extension: toExtension(file),
        }
      }
      catch {
        return undefined
      }
    }))).filter((entry): entry is { content: string, extension: string } => entry !== undefined)
    scannedCandidates.push(...scanner.scanFiles(changedContents))
  }
  const candidates = new Set(scannedCandidates)
  if (options?.bareArbitraryValues !== undefined && options.bareArbitraryValues !== false) {
    await Promise.all(files.map(async (file) => {
      try {
        const content = await fs.readFile(file, 'utf8')

        const extension = toExtension(file)
        const jsStringStaticRanges = JS_LIKE_SOURCE_EXTENSION_RE.test(extension)
          ? createJsStringStaticRanges(content)
          : undefined
        for (const candidate of extractBareArbitraryValueSourceCandidatesWithPositions(content, options.bareArbitraryValues)) {
          if (shouldKeepSourceCandidate(content, extension, candidate, jsStringStaticRanges)) {
            candidates.add(candidate.rawCandidate)
          }
        }
      }
      catch {
        // 文件可能在扫描和读取之间被移除，保持与 Tailwind 原扫描结果一致。
      }
    }))
  }
  const result = [...candidates]
  setRawCandidateCacheEntry(cacheKey, fingerprint, result)
  return [...result]
}

export async function extractValidCandidates(options?: ExtractValidCandidatesOption) {
  const providedOptions = options ?? {}
  const defaultCwd = providedOptions.cwd ?? process.cwd()

  const base = providedOptions.base ?? defaultCwd
  const baseFallbacks = providedOptions.baseFallbacks ?? []
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

  const source = {
    projectRoot: defaultCwd,
    base,
    baseFallbacks,
    css,
    dependencies: [],
  }
  const designSystemKey = getTailwindV4DesignSystemCacheKey(source)
  const designSystem = await loadTailwindV4DesignSystem(source)
  const candidateCacheKey = createCandidateCacheKey(designSystemKey, providedOptions)
  const candidateCache = designSystemCandidateCache.get(candidateCacheKey) ?? new Map<string, boolean>()
  designSystemCandidateCache.set(candidateCacheKey, candidateCache)

  const candidates = await extractRawCandidates(
    sources,
    providedOptions.bareArbitraryValues === undefined
      ? undefined
      : { bareArbitraryValues: providedOptions.bareArbitraryValues },
  )
  const inlineSources = extractTailwindV4InlineSourceCandidates(css)
  for (const candidate of inlineSources.included) {
    candidates.push(candidate)
  }
  for (const candidate of inlineSources.excluded) {
    let index = candidates.indexOf(candidate)
    while (index !== -1) {
      candidates.splice(index, 1)
      index = candidates.indexOf(candidate)
    }
  }
  const validCandidates: string[] = []
  const uncachedCandidates: string[] = []

  for (const rawCandidate of candidates) {
    const cached = candidateCache.get(rawCandidate)
    if (cached === true) {
      validCandidates.push(rawCandidate)
      continue
    }

    if (cached === false) {
      continue
    }

    const bareArbitrary = resolveBareArbitraryValueCandidate(rawCandidate, providedOptions.bareArbitraryValues)
    if (
      designSystem.parseCandidate(rawCandidate).length > 0
      || (bareArbitrary && designSystem.parseCandidate(bareArbitrary.canonicalCandidate).length > 0)
    ) {
      uncachedCandidates.push(rawCandidate)
      continue
    }

    candidateCache.set(rawCandidate, false)
  }

  if (uncachedCandidates.length === 0) {
    return validCandidates
  }

  const validUncachedCandidates = resolveValidTailwindV4Candidates(
    designSystem,
    uncachedCandidates,
    providedOptions.bareArbitraryValues === undefined
      ? undefined
      : { bareArbitraryValues: providedOptions.bareArbitraryValues },
  )

  for (const candidate of uncachedCandidates) {
    const isValid = validUncachedCandidates.has(candidate)
    candidateCache.set(candidate, isValid)
    if (!isValid) {
      continue
    }
    validCandidates.push(candidate)
  }

  return validCandidates
}

export interface ExtractProjectCandidatesOptions {
  cwd?: string
  sources?: SourceEntry[]
  base?: string
  baseFallbacks?: string[]
  css?: string
}

export interface ResolveProjectSourceFilesOptions {
  cwd?: string
  sources?: SourceEntry[]
  ignoredSources?: SourceEntry[]
  base?: string
  baseFallbacks?: string[]
  css?: string
  filter?: (file: string) => boolean
}

async function resolveScannerSources(options?: ResolveProjectSourceFilesOptions) {
  const cwd = options?.cwd ? path.resolve(options.cwd) : process.cwd()
  if (options?.sources?.length || options?.css === undefined) {
    return {
      cwd,
      sources: normalizeTailwindV4ScannerSources(options?.sources, cwd, options?.ignoredSources),
    }
  }

  const base = options.base ? path.resolve(options.base) : cwd
  const { compiled } = await compileTailwindV4Source({
    projectRoot: cwd,
    base,
    baseFallbacks: options.baseFallbacks?.map(baseFallback => path.resolve(baseFallback)) ?? [],
    css: options.css,
    dependencies: [],
  })
  return {
    cwd,
    sources: normalizeTailwindV4ScannerSources(
      createTailwindV4CompiledSourceEntries(compiled.root, compiled.sources, base),
      cwd,
      options.ignoredSources,
    ),
  }
}

export async function resolveProjectSourceFiles(options?: ResolveProjectSourceFilesOptions): Promise<string[]> {
  const { sources } = await resolveScannerSources(options)
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner({
    sources,
  })
  const files = scanner.files ?? []
  return options?.filter
    ? files.filter(options.filter)
    : files
}

export async function extractProjectCandidatesWithPositions(
  options?: ExtractProjectCandidatesOptions,
): Promise<TailwindTokenReport> {
  const { cwd, sources } = await resolveScannerSources(options)
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner({
    sources,
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

    for (const match of matches) {
      entries.push(createTokenLocation({
        cwd,
        file,
        content,
        extension,
        candidate: match.candidate,
        position: match.position,
        offsets,
      }))
    }
  }

  return {
    entries,
    filesScanned: files.length,
    skippedFiles: skipped,
    sources,
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
    const bucket = acc[bucketKey] ?? (acc[bucketKey] = [])
    const value = stripAbsolute
      ? {
          ...entry,
          file: entry.relativeFile,
        }
      : entry
    bucket.push(value)
    return acc
  }, {})
}

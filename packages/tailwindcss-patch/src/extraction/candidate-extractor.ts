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
import {
  type BareArbitraryValueOptions,
  resolveBareArbitraryValueCandidate,
} from '../v4/bare-arbitrary-values'
import { resolveValidTailwindV4Candidates } from '../v4/candidates'
import { getTailwindV4DesignSystemCacheKey, loadTailwindV4DesignSystem } from '../v4/node-adapter'

let oxideImportPromise: ReturnType<typeof importOxide> | undefined
const designSystemCandidateCache = new Map<string, Map<string, boolean>>()

function createOxideRuntimeDependencyError(cause: unknown) {
  return new Error(
    [
      'tailwindcss-patch could not load @tailwindcss/oxide, which is required for source candidate scanning.',
      'This dependency should be installed automatically by tailwindcss-patch.',
      'Reinstall dependencies without disabling optional dependencies, or install @tailwindcss/oxide@^4.2.4 manually if your package manager omitted it.',
    ].join(' '),
    { cause },
  )
}

async function importOxide() {
  try {
    return await import('@tailwindcss/oxide')
  }
  catch (error) {
    throw createOxideRuntimeDependencyError(error)
  }
}

function getOxideModule() {
  oxideImportPromise ??= importOxide()
  oxideImportPromise.catch(() => {
    oxideImportPromise = undefined
  })
  return oxideImportPromise
}

export interface ExtractValidCandidatesOption {
  sources?: SourceEntry[]
  base?: string
  baseFallbacks?: string[]
  css?: string
  cwd?: string
  bareArbitraryValues?: boolean | BareArbitraryValueOptions
}

export interface ExtractSourceCandidate {
  rawCandidate: string
  start: number
  end: number
}

interface ExtractSourceCandidateWithContext extends ExtractSourceCandidate {
  content: string
  extension: string
  localStart: number
}

const HTML_ATTRIBUTE_NAME_CANDIDATE_RE = /^(?:class|className|hover-class|hoverClass)$/
const CSS_DIRECTIVE_CANDIDATE_RE = /^@(?:apply|tailwind|source|config|plugin|theme|utility|custom-variant|variant)$/
const CSS_APPLY_IMPORTANT = '!important'
const CSS_APPLY_RE = /@apply\s+([^;{}]+)/g
const JS_LIKE_SOURCE_EXTENSION_RE = /^(?:[cm]?[jt]sx?)$/
const MIXED_TEMPLATE_SOURCE_EXTENSION_RE = /^(?:vue|uvue|nvue|svelte|mpx)$/
const CSS_LIKE_SOURCE_EXTENSION_RE = /^(?:css|wxss|acss|jxss|ttss|qss|tyss|scss|sass|less|styl|stylus)$/
const SFC_SCRIPT_BLOCK_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi

function isWhitespace(value: string | undefined) {
  return value === ' ' || value === '\n' || value === '\r' || value === '\t' || value === '\f'
}

function isHtmlAttributeNameCandidate(content: string, candidate: ExtractSourceCandidate) {
  if (!HTML_ATTRIBUTE_NAME_CANDIDATE_RE.test(candidate.rawCandidate)) {
    return false
  }
  let index = candidate.end
  while (isWhitespace(content[index])) {
    index++
  }
  return content[index] === '='
}

function isInsideHtmlTagText(content: string, candidate: ExtractSourceCandidate) {
  const open = content.lastIndexOf('<', candidate.start)
  const close = content.lastIndexOf('>', candidate.start)
  if (open > close) {
    return false
  }
  const nextOpen = content.indexOf('<', candidate.end)
  return nextOpen !== -1 && (nextOpen < content.indexOf('>', candidate.end) || content.indexOf('>', candidate.end) === -1)
}

function isCssDirectiveCandidate(candidate: string) {
  return candidate === CSS_APPLY_IMPORTANT || CSS_DIRECTIVE_CANDIDATE_RE.test(candidate)
}

function isCandidateInCssApplyParams(content: string, candidate: ExtractSourceCandidate) {
  const apply = content.lastIndexOf('@apply', candidate.start)
  if (apply === -1) {
    return false
  }
  const boundary = content.slice(apply + '@apply'.length, candidate.start)
  return !/[;{}]/.test(boundary)
}

function isCandidateInsideJsStringStaticContent(content: string, start: number) {
  let quote: '"' | '\'' | '`' | undefined
  let templateExpressionDepth = 0
  for (let index = 0; index < start; index++) {
    const char = content[index]
    const next = content[index + 1]

    if (quote && char === '\\') {
      index++
      continue
    }

    if (quote === '`' && templateExpressionDepth > 0) {
      if (char === '"' || char === '\'') {
        const nestedQuote = char
        index++
        while (index < start) {
          const nestedChar = content[index]
          if (nestedChar === '\\') {
            index += 2
            continue
          }
          if (nestedChar === nestedQuote) {
            break
          }
          index++
        }
        continue
      }
      if (char === '`') {
        index++
        while (index < start) {
          const nestedChar = content[index]
          if (nestedChar === '\\') {
            index += 2
            continue
          }
          if (nestedChar === '`') {
            break
          }
          index++
        }
        continue
      }
      if (char === '{') {
        templateExpressionDepth++
        continue
      }
      if (char === '}') {
        templateExpressionDepth--
        continue
      }
      continue
    }

    if (quote) {
      if (quote === '`' && char === '$' && next === '{') {
        templateExpressionDepth = 1
        index++
        continue
      }
      if (char === quote) {
        quote = undefined
      }
      continue
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char
    }
  }

  return quote !== undefined && templateExpressionDepth === 0
}

function shouldKeepSourceCandidate(content: string, extension: string, candidate: ExtractSourceCandidate) {
  if (!candidate.rawCandidate || isCssDirectiveCandidate(candidate.rawCandidate)) {
    return false
  }
  if (CSS_LIKE_SOURCE_EXTENSION_RE.test(extension) && !isCandidateInCssApplyParams(content, candidate)) {
    return false
  }
  if (isHtmlAttributeNameCandidate(content, candidate)) {
    return false
  }
  if (isInsideHtmlTagText(content, candidate)) {
    return false
  }
  if (
    JS_LIKE_SOURCE_EXTENSION_RE.test(extension)
    && !isCandidateInsideJsStringStaticContent(content, candidate.start)
  ) {
    return false
  }
  return true
}

function createLocalCandidate(candidate: ExtractSourceCandidateWithContext): ExtractSourceCandidate {
  return {
    rawCandidate: candidate.rawCandidate,
    start: candidate.localStart,
    end: candidate.localStart + candidate.rawCandidate.length,
  }
}

async function extractCssApplyCandidates(content: string, extension: string) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  CSS_APPLY_RE.lastIndex = 0
  let match = CSS_APPLY_RE.exec(content)
  while (match !== null) {
    const applyParams = match[1] ?? ''
    const applyParamsStart = match.index + match[0].indexOf(applyParams)
    const applyCandidates = await extractRawCandidatesWithPositions(applyParams, extension)
    candidates.push(...applyCandidates.map(candidate => ({
      content: applyParams,
      extension: 'html',
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      start: candidate.start + applyParamsStart,
      end: candidate.end + applyParamsStart,
    })))
    match = CSS_APPLY_RE.exec(content)
  }
  return candidates
}

async function extractMixedSourceScriptCandidates(content: string) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  SFC_SCRIPT_BLOCK_RE.lastIndex = 0
  let match = SFC_SCRIPT_BLOCK_RE.exec(content)
  while (match !== null) {
    const scriptContent = match[1] ?? ''
    const scriptStart = match.index + match[0].indexOf(scriptContent)
    const scriptCandidates = await extractRawCandidatesWithPositions(scriptContent, 'js')
    candidates.push(...scriptCandidates.map(candidate => ({
      content: scriptContent,
      extension: 'js',
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      start: candidate.start + scriptStart,
      end: candidate.end + scriptStart,
    })))
    match = SFC_SCRIPT_BLOCK_RE.exec(content)
  }
  return candidates
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
): Promise<ExtractSourceCandidate[]> {
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner({})
  const result = scanner.getCandidatesWithPositions({ content, extension })

  return result.map(({ candidate, position }) => ({
    rawCandidate: candidate,
    start: position,
    end: position + candidate.length,
  }))
}

export async function extractSourceCandidatesWithPositions(
  content: string,
  extension: string = 'html',
): Promise<ExtractSourceCandidate[]> {
  const normalizedExtension = extension.replace(/^\./, '')
  const candidates: ExtractSourceCandidateWithContext[] = CSS_LIKE_SOURCE_EXTENSION_RE.test(normalizedExtension)
    ? await extractCssApplyCandidates(content, normalizedExtension)
    : (await extractRawCandidatesWithPositions(content, normalizedExtension))
        .map(candidate => ({
          ...candidate,
          content,
          extension: normalizedExtension,
          localStart: candidate.start,
        }))
  if (MIXED_TEMPLATE_SOURCE_EXTENSION_RE.test(normalizedExtension)) {
    candidates.push(...await extractMixedSourceScriptCandidates(content))
  }
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (!shouldKeepSourceCandidate(candidate.content, candidate.extension, createLocalCandidate(candidate))) {
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
): Promise<string[]> {
  const candidates = await extractSourceCandidatesWithPositions(content, extension)
  return [...new Set(candidates.map(candidate => candidate.rawCandidate))]
}

export async function extractRawCandidates(
  sources?: SourceEntry[],
): Promise<string[]> {
  const { Scanner } = await getOxideModule()
  const scanner = new Scanner(sources === undefined ? {} : { sources })

  return scanner.scan()
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

  const candidates = await extractRawCandidates(sources)
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
    if (start === undefined) {
      break
    }
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
  const { Scanner } = await getOxideModule()
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

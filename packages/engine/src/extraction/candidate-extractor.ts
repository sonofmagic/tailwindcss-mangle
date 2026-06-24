import type { SourceEntry } from '@tailwindcss/oxide'
import type {
  TailwindTokenByFileMap,
  TailwindTokenFileKey,
  TailwindTokenLocation,
  TailwindTokenReport,
} from '../types.ts'
import type { BareArbitraryValueOptions } from '../v4/bare-arbitrary-values.ts'
import { promises as fs } from 'node:fs'
import process from 'node:process'
import { Parser } from 'htmlparser2'
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

let oxideImportPromise: ReturnType<typeof importOxide> | undefined
const designSystemCandidateCache = new Map<string, Map<string, boolean>>()
const DEFAULT_RAW_CANDIDATE_CACHE_LIMIT = 64
const RAW_CANDIDATE_CACHE_LIMIT = (() => {
  const rawLimit = process.env['TWM_ENGINE_RAW_CANDIDATE_CACHE_LIMIT']
  if (rawLimit === undefined) {
    return DEFAULT_RAW_CANDIDATE_CACHE_LIMIT
  }
  const limit = Number.parseInt(rawLimit, 10)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_RAW_CANDIDATE_CACHE_LIMIT
})()
const rawCandidateCache = new Map<string, {
  fingerprint: string
  candidates: string[]
}>()

function createOxideRuntimeDependencyError(cause: unknown) {
  return new Error(
    [
      '@tailwindcss-mangle/engine could not load @tailwindcss/oxide, which is required for source candidate scanning.',
      'This dependency should be installed automatically by @tailwindcss-mangle/engine.',
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

export interface ExtractCandidateOptions {
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
  skipHtmlContextChecks?: boolean
}

interface JsStringStaticRange {
  start: number
  end: number
}

interface SourceSegment {
  content: string
  start: number
}

interface JoinedSourceSegment extends SourceSegment {
  joinedStart: number
}

const HTML_ATTRIBUTE_NAME_CANDIDATE_RE = /^(?:class|className|hover-class|hoverClass)$/
const HTML_BOUND_ATTRIBUTE_PREFIX_RE = /^(?::|v-bind:|bind:)/
const CSS_DIRECTIVE_CANDIDATE_RE = /^@(?:apply|tailwind|source|config|plugin|theme|utility|custom-variant|variant)$/
const CSS_APPLY_IMPORTANT = '!important'
const CSS_APPLY_RE = /@apply\s+([^;{}]+)/g
const JS_LIKE_SOURCE_EXTENSION_RE = /^[cm]?[jt]sx?$/
const MIXED_TEMPLATE_SOURCE_EXTENSION_RE = /^(?:vue|uvue|nvue|svelte|mpx)$/
const VUE_LIKE_SOURCE_EXTENSION_RE = /^(?:vue|uvue|nvue)$/
const CSS_LIKE_SOURCE_EXTENSION_RE = /^(?:css|wxss|acss|jxss|ttss|qss|tyss|scss|sass|less|styl|stylus)$/
const CLASS_LIKE_CANDIDATE_RE = /[:![\]#/%._\-\d]/
const VUE_HTML_TEMPLATE_LANG_RE = /^(?:html)?$/i
const SFC_SCRIPT_BLOCK_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
const SFC_STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
const SFC_TEMPLATE_BLOCK_RE = /<template\b([^>]*)>([\s\S]*?)<\/template>/gi
const SFC_LANG_ATTRIBUTE_RE = /\blang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i

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

function normalizeVueBoundAttributeName(name: string) {
  return name.replace(HTML_BOUND_ATTRIBUTE_PREFIX_RE, '')
}

function isVueClassAttributeNameCandidate(name: string) {
  return HTML_ATTRIBUTE_NAME_CANDIDATE_RE.test(normalizeVueBoundAttributeName(name))
}

function isVueBoundAttributeName(name: string) {
  return HTML_BOUND_ATTRIBUTE_PREFIX_RE.test(name)
}

function normalizeVueTemplateLang(lang: string | undefined) {
  return lang?.trim().toLowerCase() ?? ''
}

function getSfcBlockLang(attributes: string) {
  const match = SFC_LANG_ATTRIBUTE_RE.exec(attributes)
  return normalizeVueTemplateLang(match?.[1] ?? match?.[2] ?? match?.[3])
}

function isVueHtmlTemplateLang(lang: string) {
  return VUE_HTML_TEMPLATE_LANG_RE.test(lang)
}

function isInsideHtmlTagText(content: string, candidate: ExtractSourceCandidate) {
  const open = content.lastIndexOf('<', candidate.start)
  const close = content.lastIndexOf('>', candidate.start)
  if (open > close) {
    return false
  }
  const nextOpen = content.indexOf('<', candidate.end)
  return nextOpen !== -1 && (nextOpen < content.indexOf('>', candidate.end) || !content.includes('>', candidate.end))
}

function isCssDirectiveCandidate(candidate: string) {
  return candidate === CSS_APPLY_IMPORTANT || CSS_DIRECTIVE_CANDIDATE_RE.test(candidate)
}

function isClassLikeCandidate(candidate: string) {
  return CLASS_LIKE_CANDIDATE_RE.test(candidate)
}

function isCandidateInCssApplyParams(content: string, candidate: ExtractSourceCandidate) {
  const apply = content.lastIndexOf('@apply', candidate.start)
  if (apply === -1) {
    return false
  }
  const boundary = content.slice(apply + '@apply'.length, candidate.start)
  return !/[;{}]/.test(boundary)
}

function skipQuotedJsContent(content: string, index: number, quote: '"' | '\'' | '`') {
  index++
  while (index < content.length) {
    const char = content[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === quote) {
      return index + 1
    }
    index++
  }
  return index
}

function createJsStringStaticRanges(content: string) {
  const ranges: JsStringStaticRange[] = []
  let quote: '"' | '\'' | '`' | undefined
  let stringStart = -1
  let templateExpressionDepth = 0

  for (let index = 0; index < content.length; index++) {
    const char = content[index]
    const next = content[index + 1]

    if (quote && char === '\\') {
      index++
      continue
    }

    if (quote === '`' && templateExpressionDepth > 0) {
      if (char === '"' || char === '\'') {
        index = skipQuotedJsContent(content, index, char) - 1
        continue
      }
      if (char === '`') {
        index = skipQuotedJsContent(content, index, '`') - 1
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
        ranges.push({ start: stringStart, end: index })
        templateExpressionDepth = 1
        index++
        continue
      }
      if (char === quote) {
        ranges.push({ start: stringStart, end: index })
        quote = undefined
        stringStart = -1
      }
      continue
    }

    if (char === '"' || char === '\'' || char === '`') {
      quote = char
      stringStart = index + 1
    }
  }

  if (quote !== undefined && templateExpressionDepth === 0) {
    ranges.push({ start: stringStart, end: content.length })
  }
  return ranges
}

function isCandidateInsideJsStringStaticRanges(ranges: JsStringStaticRange[], start: number) {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const range = ranges[mid]
    if (range === undefined) {
      break
    }
    if (start < range.start) {
      high = mid - 1
      continue
    }
    if (start >= range.end) {
      low = mid + 1
      continue
    }
    return true
  }
  return false
}

function shouldKeepSourceCandidate(
  content: string,
  extension: string,
  candidate: ExtractSourceCandidate,
  jsStringStaticRanges?: JsStringStaticRange[],
  skipHtmlContextChecks = false,
) {
  if (!candidate.rawCandidate || isCssDirectiveCandidate(candidate.rawCandidate)) {
    return false
  }
  if (CSS_LIKE_SOURCE_EXTENSION_RE.test(extension) && !isCandidateInCssApplyParams(content, candidate)) {
    return false
  }
  if (!skipHtmlContextChecks) {
    if (isHtmlAttributeNameCandidate(content, candidate)) {
      return false
    }
    if (isInsideHtmlTagText(content, candidate)) {
      return false
    }
  }
  if (
    JS_LIKE_SOURCE_EXTENSION_RE.test(extension)
    && !isCandidateInsideJsStringStaticRanges(jsStringStaticRanges ?? createJsStringStaticRanges(content), candidate.start)
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

function dedupeCandidatesWithPositions(candidates: ExtractSourceCandidate[]) {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.start}:${candidate.end}:${candidate.rawCandidate}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function createBareArbitraryValueCandidateContexts(
  content: string,
  extension: string,
  offset: number,
  options?: ExtractCandidateOptions,
): ExtractSourceCandidateWithContext[] {
  return extractBareArbitraryValueSourceCandidatesWithPositions(content, options?.bareArbitraryValues)
    .map(candidate => ({
      content,
      extension,
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      start: candidate.start + offset,
      end: candidate.end + offset,
    }))
}

async function extractCssApplyCandidates(content: string, extension: string, options?: ExtractCandidateOptions) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  CSS_APPLY_RE.lastIndex = 0
  let match = CSS_APPLY_RE.exec(content)
  while (match !== null) {
    const applyParams = match[1] ?? ''
    const applyParamsStart = match.index + match[0].indexOf(applyParams)
    // eslint-disable-next-line ts/no-use-before-define
    const applyCandidates = await extractRawCandidatesWithPositions(applyParams, extension)
    candidates.push(...applyCandidates.map(candidate => ({
      content: applyParams,
      extension: 'html',
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      skipHtmlContextChecks: true,
      start: candidate.start + applyParamsStart,
      end: candidate.end + applyParamsStart,
    })))
    candidates.push(...createBareArbitraryValueCandidateContexts(applyParams, 'html', applyParamsStart, options))
    match = CSS_APPLY_RE.exec(content)
  }
  return candidates
}

async function extractMixedSourceScriptCandidates(content: string, options?: ExtractCandidateOptions) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  SFC_SCRIPT_BLOCK_RE.lastIndex = 0
  let match = SFC_SCRIPT_BLOCK_RE.exec(content)
  while (match !== null) {
    const scriptContent = match[1] ?? ''
    const scriptStart = match.index + match[0].indexOf(scriptContent)
    // eslint-disable-next-line ts/no-use-before-define
    candidates.push(...await extractJsStringSourceCandidates(scriptContent, scriptStart, options))
    match = SFC_SCRIPT_BLOCK_RE.exec(content)
  }
  return candidates
}

async function extractMixedSourceStyleCandidates(content: string, options?: ExtractCandidateOptions) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  SFC_STYLE_BLOCK_RE.lastIndex = 0
  let match = SFC_STYLE_BLOCK_RE.exec(content)
  while (match !== null) {
    const styleContent = match[1] ?? ''
    const styleStart = match.index + match[0].indexOf(styleContent)
    const styleCandidates = await extractCssApplyCandidates(styleContent, 'css', options)
    candidates.push(...styleCandidates.map(candidate => ({
      content: candidate.content,
      extension: candidate.extension,
      localStart: candidate.localStart,
      rawCandidate: candidate.rawCandidate,
      start: candidate.start + styleStart,
      end: candidate.end + styleStart,
    })))
    match = SFC_STYLE_BLOCK_RE.exec(content)
  }
  return candidates
}

function joinSourceSegments(segments: SourceSegment[]) {
  const joinedSegments: JoinedSourceSegment[] = []
  const parts: string[] = []
  let joinedStart = 0

  for (const segment of segments) {
    if (parts.length > 0) {
      parts.push('\n')
      joinedStart++
    }
    parts.push(segment.content)
    joinedSegments.push({
      ...segment,
      joinedStart,
    })
    joinedStart += segment.content.length
  }

  return {
    content: parts.join(''),
    segments: joinedSegments,
  }
}

function findJoinedSourceSegment(segments: JoinedSourceSegment[], start: number) {
  let low = 0
  let high = segments.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const segment = segments[mid]
    if (segment === undefined) {
      break
    }
    if (start < segment.joinedStart) {
      high = mid - 1
      continue
    }
    if (start >= segment.joinedStart + segment.content.length) {
      low = mid + 1
      continue
    }
    return segment
  }
  return undefined
}

async function extractBatchedSourceSegmentCandidates(
  segments: SourceSegment[],
  extension: string,
  options?: ExtractCandidateOptions,
) {
  if (segments.length === 0) {
    return []
  }

  const joined = joinSourceSegments(segments)
  // eslint-disable-next-line ts/no-use-before-define
  const rawCandidates = await extractRawCandidatesWithPositions(joined.content, extension, options)
  const candidates: ExtractSourceCandidateWithContext[] = []
  for (const candidate of rawCandidates) {
    const segment = findJoinedSourceSegment(joined.segments, candidate.start)
    if (segment === undefined || candidate.end > segment.joinedStart + segment.content.length) {
      continue
    }
    const segmentOffset = candidate.start - segment.joinedStart
    candidates.push({
      content: joined.content,
      extension,
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      skipHtmlContextChecks: true,
      start: segment.start + segmentOffset,
      end: segment.start + segmentOffset + candidate.rawCandidate.length,
    })
  }
  return candidates
}

function createJsStringSourceSegments(
  content: string,
  offset: number,
) {
  return createJsStringStaticRanges(content)
    .filter(range => range.end > range.start)
    .map(range => ({
      content: content.slice(range.start, range.end),
      start: offset + range.start,
    }))
}

async function extractJsStringSourceCandidates(
  content: string,
  offset: number,
  options?: ExtractCandidateOptions,
) {
  const segments = createJsStringSourceSegments(content, offset)
  return extractBatchedSourceSegmentCandidates(segments, 'html', options)
}

function findAttributeValueStart(attributeSource: string, value: string) {
  const equalIndex = attributeSource.indexOf('=')
  if (equalIndex === -1) {
    return -1
  }

  let valueStart = equalIndex + 1
  while (isWhitespace(attributeSource[valueStart])) {
    valueStart++
  }

  const quote = attributeSource[valueStart]
  if (quote === '"' || quote === '\'') {
    valueStart++
  }

  const valueIndex = attributeSource.indexOf(value, valueStart)
  return valueIndex === -1 ? valueStart : valueIndex
}

async function extractVueTemplateAttributeCandidates(content: string, options?: ExtractCandidateOptions) {
  const htmlSegments: SourceSegment[] = []
  const jsSegments: SourceSegment[] = []
  const parser = new Parser({
    onattribute(name, value) {
      if (!value || !isVueClassAttributeNameCandidate(name)) {
        return
      }

      const attributeStart = parser.startIndex
      const attributeSource = content.slice(attributeStart, parser.endIndex + 1)
      const valueStartInAttribute = findAttributeValueStart(attributeSource, value)
      if (valueStartInAttribute === -1) {
        return
      }

      const extension = isVueBoundAttributeName(name) ? 'js' : 'html'
      const valueStart = attributeStart + valueStartInAttribute
      const segments = extension === 'js' ? jsSegments : htmlSegments
      segments.push({
        content: value,
        start: valueStart,
      })
    },
  }, {
    lowerCaseAttributeNames: false,
  })

  parser.write(content)
  parser.end()
  const jsStringSegments = jsSegments.flatMap(segment => createJsStringSourceSegments(segment.content, segment.start))
  const [htmlCandidates, jsCandidates] = await Promise.all([
    extractBatchedSourceSegmentCandidates(htmlSegments, 'html', options),
    extractBatchedSourceSegmentCandidates(jsStringSegments, 'html', options),
  ])
  return [
    ...htmlCandidates,
    ...jsCandidates,
  ]
}

async function extractVueNonHtmlTemplateCandidates(content: string, options?: ExtractCandidateOptions) {
  const candidates: ExtractSourceCandidateWithContext[] = []
  SFC_TEMPLATE_BLOCK_RE.lastIndex = 0
  let match = SFC_TEMPLATE_BLOCK_RE.exec(content)
  while (match !== null) {
    const attributes = match[1] ?? ''
    const templateContent = match[2] ?? ''
    const lang = getSfcBlockLang(attributes)
    if (isVueHtmlTemplateLang(lang)) {
      match = SFC_TEMPLATE_BLOCK_RE.exec(content)
      continue
    }

    const templateStart = match.index + match[0].indexOf(templateContent)
    // eslint-disable-next-line ts/no-use-before-define
    const templateCandidates = await extractRawCandidatesWithPositions(templateContent, lang, options)
    candidates.push(...templateCandidates.map(candidate => ({
      content: templateContent,
      extension: lang,
      localStart: candidate.start,
      rawCandidate: candidate.rawCandidate,
      skipHtmlContextChecks: true,
      start: candidate.start + templateStart,
      end: candidate.end + templateStart,
    })).filter(candidate => isClassLikeCandidate(candidate.rawCandidate)))
    match = SFC_TEMPLATE_BLOCK_RE.exec(content)
  }
  return candidates
}

async function extractVueLikeSourceCandidates(content: string, options?: ExtractCandidateOptions) {
  const [templateCandidates, preprocessedTemplateCandidates, scriptCandidates, styleCandidates] = await Promise.all([
    extractVueTemplateAttributeCandidates(content, options),
    extractVueNonHtmlTemplateCandidates(content, options),
    extractMixedSourceScriptCandidates(content, options),
    extractMixedSourceStyleCandidates(content, options),
  ])
  return [
    ...templateCandidates,
    ...preprocessedTemplateCandidates,
    ...scriptCandidates,
    ...styleCandidates,
  ]
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

function createRawCandidateCacheKey(sources: SourceEntry[] | undefined, options?: ExtractCandidateOptions) {
  return JSON.stringify({
    sources: sources ?? null,
    bareArbitraryValues: options?.bareArbitraryValues ?? null,
  })
}

async function createRawCandidateFileFingerprint(files: string[] | undefined) {
  if (!files?.length) {
    return ''
  }

  const entries = await Promise.all(files.map(async (file) => {
    try {
      const stats = await fs.stat(file)
      return `${file}:${stats.size}:${stats.mtimeMs}`
    }
    catch {
      return `${file}:missing`
    }
  }))
  return entries.sort().join('|')
}

function getRawCandidateCacheEntry(cacheKey: string, fingerprint: string) {
  const cached = rawCandidateCache.get(cacheKey)
  if (cached?.fingerprint !== fingerprint) {
    return undefined
  }
  rawCandidateCache.delete(cacheKey)
  rawCandidateCache.set(cacheKey, cached)
  return cached
}

function setRawCandidateCacheEntry(cacheKey: string, fingerprint: string, candidates: string[]) {
  rawCandidateCache.set(cacheKey, {
    fingerprint,
    candidates,
  })

  while (rawCandidateCache.size > RAW_CANDIDATE_CACHE_LIMIT) {
    const oldestKey = rawCandidateCache.keys().next().value
    if (oldestKey === undefined) {
      break
    }
    rawCandidateCache.delete(oldestKey)
  }
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
    ? await extractVueLikeSourceCandidates(content, options)
    : CSS_LIKE_SOURCE_EXTENSION_RE.test(normalizedExtension)
      ? await extractCssApplyCandidates(content, normalizedExtension, options)
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
    candidates.push(...await extractMixedSourceScriptCandidates(content, options))
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

  const candidates = new Set(scanner.scan())
  if (options?.bareArbitraryValues !== undefined && options.bareArbitraryValues !== false) {
    await Promise.all(files.map(async (file) => {
      try {
        const content = await fs.readFile(file, 'utf8')
        // eslint-disable-next-line ts/no-use-before-define
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

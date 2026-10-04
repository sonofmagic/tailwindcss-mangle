import type { SourceEntry } from '@tailwindcss/oxide'
import type { TailwindV4CompiledSourceRoot, TailwindV4SourcePattern } from './types.ts'
import { realpathSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import process from 'node:process'
import { expandSourceEntryBracesNative, groupSourceEntriesNative, mergeSourceEntriesNative, normalizeGlobPatternNative, splitStaticGlobPrefixNative, uniqueStringsNative } from '@tailwindcss-mangle/native'
import micromatch from 'micromatch'
import path from 'pathe'

export const TAILWIND_V4_IGNORED_CONTENT_DIRS = [
  '.git',
  '.hg',
  '.jj',
  '.next',
  '.parcel-cache',
  '.pnpm-store',
  '.svelte-kit',
  '.svn',
  '.turbo',
  '.venv',
  '.vercel',
  '.yarn',
  '__pycache__',
  'node_modules',
  'venv',
]

export const TAILWIND_V4_IGNORED_EXTENSIONS = [
  'less',
  'lock',
  'sass',
  'scss',
  'styl',
  'log',
]

export const TAILWIND_V4_IGNORED_FILES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.gitignore',
  '.env',
  '.env.*',
]

export const TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN = '**/*'

function uniqueResolvedPaths(values: Iterable<string | undefined>) {
  return uniqueStringsNative([...values].filter((value): value is string => Boolean(value)).map(value => path.resolve(value)))
}

export function toPosixPath(value: string) {
  return value.replaceAll(path.sep, '/')
}

export function resolveSourceScanPath(value: string) {
  const resolved = path.resolve(value)
  try {
    return realpathSync.native(resolved)
  }
  catch {
    return resolved
  }
}

export const normalizeGlobPattern = normalizeGlobPatternNative

async function pathExistsAsDirectory(file: string) {
  try {
    return (await stat(file)).isDirectory()
  }
  catch {
    return false
  }
}

export function createTailwindV4DefaultIgnoreSources(base: string): TailwindV4SourcePattern[] {
  return [
    ...TAILWIND_V4_IGNORED_CONTENT_DIRS.map(pattern => ({
      base,
      pattern: `**/${pattern}/**`,
      negated: true,
    })),
    ...TAILWIND_V4_IGNORED_EXTENSIONS.map(extension => ({
      base,
      pattern: `**/*.${extension}`,
      negated: true,
    })),
    ...TAILWIND_V4_IGNORED_FILES.map(pattern => ({
      base,
      pattern: `**/${pattern}`,
      negated: true,
    })),
  ]
}

export function createTailwindV4RootSources(
  root: TailwindV4CompiledSourceRoot,
  fallbackBase: string,
): TailwindV4SourcePattern[] {
  if (root === 'none') {
    return []
  }
  if (root === null) {
    return [{ base: fallbackBase, pattern: TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN, negated: false }]
  }
  return [{ ...root, negated: false }]
}

export function createTailwindV4CompiledSourceEntries(
  root: TailwindV4CompiledSourceRoot,
  sources: TailwindV4SourcePattern[],
  fallbackBase: string,
) {
  return [
    ...createTailwindV4RootSources(root, fallbackBase),
    ...sources,
  ]
}

export async function resolveTailwindV4SourceEntry(
  sourcePath: string,
  base: string,
  negated: boolean,
  defaultPattern = TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN,
): Promise<TailwindV4SourcePattern> {
  const absoluteSource = path.isAbsolute(sourcePath) ? path.resolve(sourcePath) : path.resolve(base, sourcePath)

  if (await pathExistsAsDirectory(absoluteSource)) {
    return {
      base: absoluteSource,
      negated,
      pattern: normalizeGlobPattern(defaultPattern),
    }
  }

  if (path.isAbsolute(sourcePath)) {
    return {
      base: path.dirname(absoluteSource),
      negated,
      pattern: normalizeGlobPattern(path.basename(absoluteSource)),
    }
  }

  const { prefix, rest } = splitStaticGlobPrefixNative(sourcePath)
  if (prefix.length > 0 && rest.length > 0) {
    return {
      base: path.resolve(base, ...prefix),
      negated,
      pattern: normalizeGlobPattern(rest.join('/')),
    }
  }

  return {
    base,
    negated,
    pattern: normalizeGlobPattern(sourcePath),
  }
}

export async function normalizeTailwindV4SourceEntries(
  sources: TailwindV4SourcePattern[],
  options: {
    cwd?: string
    defaultPattern?: string
  } = {},
) {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd()
  return Promise.all(sources.map(source =>
    resolveTailwindV4SourceEntry(
      source.pattern,
      source.base ? path.resolve(source.base) : cwd,
      source.negated,
      options.defaultPattern,
    )))
}

export function expandTailwindV4SourceEntryBraces(sources: TailwindV4SourcePattern[]): TailwindV4SourcePattern[] {
  return expandSourceEntryBracesNative(sources.map(source => ({ ...source, base: path.resolve(source.base) })))
}

export function normalizeTailwindV4ScannerSources(
  sources: TailwindV4SourcePattern[] | undefined,
  cwd: string,
  ignoredSources: TailwindV4SourcePattern[] = [],
): SourceEntry[] {
  const baseSources = sources?.length
    ? sources
    : [
        {
          base: cwd,
          pattern: TAILWIND_V4_AUTO_SOURCE_SCAN_PATTERN,
          negated: false,
        },
      ]

  return expandTailwindV4SourceEntryBraces([...baseSources, ...ignoredSources])
}

function normalizeEntryPattern(entry: TailwindV4SourcePattern) {
  return path.isAbsolute(entry.pattern)
    ? toPosixPath(path.relative(resolveSourceScanPath(entry.base), entry.pattern))
    : normalizeGlobPattern(entry.pattern)
}

function isFileMatchedByTailwindV4SourceEntry(file: string, entry: TailwindV4SourcePattern) {
  const relative = toPosixPath(path.relative(resolveSourceScanPath(entry.base), file))
  return Boolean(relative)
    && !relative.startsWith('../')
    && !path.isAbsolute(relative)
    && micromatch.isMatch(relative, normalizeEntryPattern(entry))
}

export function isFileExcludedByTailwindV4SourceEntries(
  file: string,
  entries: TailwindV4SourcePattern[] | undefined,
) {
  if (!entries?.length) {
    return false
  }
  const resolvedFile = resolveSourceScanPath(file)
  return entries.some(entry => entry.negated && isFileMatchedByTailwindV4SourceEntry(resolvedFile, entry))
}

export function isFileMatchedByTailwindV4SourceEntries(
  file: string,
  entries: TailwindV4SourcePattern[] | undefined,
) {
  if (!entries?.length) {
    return true
  }

  const positiveEntries = entries.filter(entry => !entry.negated)
  const negativeEntries = entries.filter(entry => entry.negated)
  if (positiveEntries.length === 0) {
    return false
  }

  const resolvedFile = resolveSourceScanPath(file)
  const matchesPositive = positiveEntries.some(entry => isFileMatchedByTailwindV4SourceEntry(resolvedFile, entry))
  if (!matchesPositive) {
    return false
  }

  return !negativeEntries.some(entry => isFileMatchedByTailwindV4SourceEntry(resolvedFile, entry))
}

export function createTailwindV4SourceEntryMatcher(entries: TailwindV4SourcePattern[] | undefined) {
  if (!entries?.length) {
    return undefined
  }
  return (file: string) => isFileMatchedByTailwindV4SourceEntries(file, entries)
}

export function createTailwindV4SourceExclusionMatcher(entries: TailwindV4SourcePattern[] | undefined) {
  if (!entries?.length) {
    return undefined
  }
  return (file: string) => isFileExcludedByTailwindV4SourceEntries(file, entries)
}

export function groupTailwindV4SourceEntriesByBase(entries: TailwindV4SourcePattern[]) {
  return new Map(groupSourceEntriesNative(entries.map(entry => ({ ...entry, base: path.resolve(entry.base) })))
    .map(group => [group.base, group.entries]))
}

export async function expandTailwindV4SourceEntries(
  entries: TailwindV4SourcePattern[],
  resolveFiles: (options: { cwd: string, sources: TailwindV4SourcePattern[] }) => Promise<string[]>,
) {
  if (entries.length === 0) {
    return []
  }

  const files = new Set<string>()
  await Promise.all([...groupTailwindV4SourceEntriesByBase(entries).entries()].map(async ([base, group]) => {
    const matched = await resolveFiles({
      cwd: base,
      sources: group,
    })
    for (const file of matched) {
      files.add(path.resolve(file))
    }
  }))

  return [...files].filter(file => !isFileExcludedByTailwindV4SourceEntries(file, entries))
}

export function mergeTailwindV4SourceEntries(...entries: Array<TailwindV4SourcePattern[] | undefined>) {
  return mergeSourceEntriesNative(entries.flatMap(group => group ?? [])
    .map(entry => ({ ...entry, base: path.resolve(entry.base) })))
}

export function resolveTailwindV4SourceBaseCandidates(
  projectRoot: string,
  base: string,
  baseFallbacks: string[],
) {
  return uniqueResolvedPaths([base, projectRoot, ...baseFallbacks])
}

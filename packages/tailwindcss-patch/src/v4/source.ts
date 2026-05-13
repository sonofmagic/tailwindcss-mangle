import type { NormalizedTailwindCssPatchOptions, TailwindCssPatchOptions } from '../config'
import type { TailwindV4CssSource, TailwindV4ResolvedSource, TailwindV4SourceOptions } from './types'
import { promises as fs } from 'node:fs'
import process from 'node:process'
import path from 'pathe'
import { normalizeOptions } from '../config'

function resolveBase(value: string | undefined, fallback: string) {
  return value === undefined
    ? fallback
    : path.isAbsolute(value)
      ? path.resolve(value)
      : path.resolve(fallback, value)
}

function uniquePaths(values: Iterable<string | undefined>) {
  const result: string[] = []
  for (const value of values) {
    if (!value) {
      continue
    }
    const resolved = path.resolve(value)
    if (!result.includes(resolved)) {
      result.push(resolved)
    }
  }
  return result
}

function toCssImportPath(value: string) {
  return value.replaceAll('\\', '/')
}

function quoteCssImport(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function isPostcssPluginSpecifier(packageName: string) {
  return packageName === '@tailwindcss/postcss'
    || /(?:^|[/\\])@tailwindcss[/\\]postcss(?:[/\\]|$)/.test(packageName)
    || /(?:^|[/\\])postcss(?:[/\\]|$)/i.test(packageName)
    || /postcss\.config\.[cm]?[jt]s$/i.test(packageName)
}

function createDefaultCss(packageName: string | undefined) {
  const cssPackageName = packageName && !isPostcssPluginSpecifier(packageName)
    ? packageName
    : 'tailwindcss'
  return `@import "${quoteCssImport(toCssImportPath(cssPackageName))}";`
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

async function resolveCssEntries(entries: string[], projectRoot: string, base: string | undefined) {
  const resolvedEntries = entries.map(entry => ({
    original: entry,
    absolute: path.isAbsolute(entry) ? path.resolve(entry) : path.resolve(projectRoot, entry),
  }))
  const resolvedBase = base ?? path.dirname(resolvedEntries[0]?.absolute ?? projectRoot)
  const dependencies = resolvedEntries.map(entry => entry.absolute)
  const cssParts: string[] = []

  for (const entry of resolvedEntries) {
    if (await pathExists(entry.absolute)) {
      cssParts.push(await fs.readFile(entry.absolute, 'utf8'))
      continue
    }

    const importPath = path.isAbsolute(entry.original)
      ? entry.absolute
      : path.relative(resolvedBase, entry.absolute)
    cssParts.push(`@import "${quoteCssImport(toCssImportPath(importPath))}";`)
  }

  return {
    base: resolvedBase,
    css: cssParts.join('\n'),
    dependencies,
  }
}

function resolveCssSources(sources: TailwindV4CssSource[], projectRoot: string, base: string | undefined) {
  const resolvedSources = sources.map(source => ({
    ...source,
    base: source.base === undefined ? undefined : resolveBase(source.base, projectRoot),
    file: source.file === undefined
      ? undefined
      : path.isAbsolute(source.file)
        ? path.resolve(source.file)
        : path.resolve(projectRoot, source.file),
    dependencies: source.dependencies?.map(dependency =>
      path.isAbsolute(dependency) ? path.resolve(dependency) : path.resolve(projectRoot, dependency),
    ) ?? [],
  }))
  const firstSource = resolvedSources[0]
  const resolvedBase = base
    ?? firstSource?.base
    ?? (firstSource?.file ? path.dirname(firstSource.file) : projectRoot)
  const dependencies = resolvedSources.flatMap(source => [
    source.file,
    ...source.dependencies,
  ]).filter((dependency): dependency is string => Boolean(dependency))

  return {
    base: resolvedBase,
    css: resolvedSources.map(source => source.css).join('\n'),
    dependencies,
  }
}

function normalizeResolvedSource(
  source: {
    projectRoot: string
    cwd: string
    base: string
    baseFallbacks: string[]
    css: string
    dependencies: string[]
  },
): TailwindV4ResolvedSource {
  const baseFallbacks = uniquePaths([
    ...source.baseFallbacks,
    source.projectRoot,
    source.cwd,
  ]).filter(base => base !== source.base)

  return {
    projectRoot: source.projectRoot,
    base: source.base,
    baseFallbacks,
    css: source.css,
    dependencies: Array.from(new Set(source.dependencies.map(dependency => path.resolve(dependency)))),
  }
}

export async function resolveTailwindV4Source(options: TailwindV4SourceOptions = {}): Promise<TailwindV4ResolvedSource> {
  const projectRoot = resolveBase(options.projectRoot, process.cwd())
  const cwd = resolveBase(options.cwd, projectRoot)
  const configuredBase = options.base === undefined ? undefined : resolveBase(options.base, projectRoot)
  const baseFallbacks = uniquePaths(options.baseFallbacks?.map(base => resolveBase(base, projectRoot)) ?? [])

  if (options.css !== undefined) {
    return normalizeResolvedSource({
      projectRoot,
      cwd,
      base: configuredBase ?? cwd,
      baseFallbacks,
      css: options.css,
      dependencies: [],
    })
  }

  if (options.cssEntries?.length || options.cssSources?.length) {
    const entries = options.cssEntries?.length
      ? await resolveCssEntries(options.cssEntries, projectRoot, configuredBase)
      : undefined
    const sources = options.cssSources?.length
      ? resolveCssSources(options.cssSources, projectRoot, configuredBase)
      : undefined
    const css = [
      entries?.css,
      sources?.css,
    ].filter(Boolean).join('\n')
    return normalizeResolvedSource({
      projectRoot,
      cwd,
      base: configuredBase ?? entries?.base ?? sources?.base ?? cwd,
      baseFallbacks,
      css,
      dependencies: [
        ...(entries?.dependencies ?? []),
        ...(sources?.dependencies ?? []),
      ],
    })
  }

  return normalizeResolvedSource({
    projectRoot,
    cwd,
    base: configuredBase ?? cwd,
    baseFallbacks,
    css: createDefaultCss(options.packageName),
    dependencies: [],
  })
}

function resolveConfigDir(config: string | undefined, projectRoot: string) {
  if (!config) {
    return undefined
  }
  const configPath = path.isAbsolute(config) ? config : path.resolve(projectRoot, config)
  return path.dirname(configPath)
}

function createSourceOptionsFromNormalizedPatchOptions(
  options: NormalizedTailwindCssPatchOptions,
): TailwindV4SourceOptions {
  const v4 = options.tailwind.v4
  const configDir = resolveConfigDir(options.tailwind.config, options.projectRoot)
  const baseFallbacks = uniquePaths([
    v4?.configuredBase,
    options.tailwind.cwd,
    options.projectRoot,
    configDir,
  ])

  return {
    projectRoot: options.projectRoot,
    ...(options.tailwind.cwd === undefined ? {} : { cwd: options.tailwind.cwd }),
    ...(v4?.configuredBase === undefined ? {} : { base: v4.configuredBase }),
    baseFallbacks,
    ...(v4?.css === undefined ? {} : { css: v4.css }),
    ...(v4?.cssSources === undefined ? {} : { cssSources: v4.cssSources }),
    ...(v4?.cssEntries === undefined ? {} : { cssEntries: v4.cssEntries }),
    packageName: options.tailwind.packageName,
  }
}

export function tailwindV4SourceOptionsFromPatchOptions(options: TailwindCssPatchOptions): TailwindV4SourceOptions {
  return createSourceOptionsFromNormalizedPatchOptions(normalizeOptions(options))
}

export async function resolveTailwindV4SourceFromPatchOptions(
  options: TailwindCssPatchOptions,
): Promise<TailwindV4ResolvedSource> {
  return resolveTailwindV4Source(tailwindV4SourceOptionsFromPatchOptions(options))
}

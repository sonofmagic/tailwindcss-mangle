import type { SourceEntry } from '@tailwindcss/oxide'
/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'pathe'
import {
  extractProjectCandidatesWithPositions,
  extractRawCandidates,
  extractSourceCandidatesWithPositions,
  extractValidCandidates,
} from '../src/extraction/candidate-extractor.ts'
import {
  canonicalizeBareArbitraryValueCandidates,
  compileTailwindV4Source,
  createTailwindV4Engine,
  extractTailwindV4InlineSourceCandidates,
  loadTailwindV4DesignSystem,
  replaceBareArbitraryValueSelectors,
  resolveTailwindV4Source,
  resolveValidTailwindV4Candidates,
} from '../src/v4/index.ts'

interface BenchProfile {
  filesPerExtension: number
  blocksPerFile: number
  warmups: number
  iterations: number
}

interface GeneratedFile {
  file: string
  extension: string
  bytes: number
  blocks: number
}

interface DatasetSummary {
  root: string
  files: GeneratedFile[]
  totalBytes: number
  totalBlocks: number
}

interface TimedResult<T> {
  durationMs: number
  value: T
}

interface BenchResult {
  scenario: string
  samples: number
  minMs: number
  meanMs: number
  medianMs: number
  p95Ms: number
  throughputMbPerSecond?: number
  details: Record<string, string | number>
}

interface PhaseBenchResult {
  scenario: string
  samples: number
  phases: Record<string, number>
  details: Record<string, string | number>
}

const require = createRequire(import.meta.url)
const benchDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(benchDir, '..')
const generatedRoot = path.join(benchDir, 'generated', 'large-project')
const reportFile = path.join(benchDir, 'reports', 'latest.md')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))

const extensions = ['html', 'vue', 'js', 'ts', 'jsx', 'tsx', 'wxml', 'css', 'svelte', 'astro'] as const
const validCandidates = [
  'flex',
  'grid',
  'hidden',
  'block',
  'inline-flex',
  'items-center',
  'items-start',
  'justify-between',
  'justify-center',
  'gap-2',
  'gap-4',
  'gap-6',
  'rounded-md',
  'rounded-lg',
  'border',
  'border-slate-200',
  'bg-white',
  'bg-slate-50',
  'bg-blue-500',
  'bg-emerald-500',
  'text-sm',
  'text-base',
  'text-lg',
  'text-slate-700',
  'text-white',
  'font-medium',
  'font-semibold',
  'p-2',
  'p-4',
  'px-3',
  'px-6',
  'py-2',
  'py-4',
  'm-2',
  'mx-auto',
  'w-full',
  'max-w-screen-xl',
  'min-h-screen',
  'shadow-sm',
  'shadow-lg',
  'transition',
  'duration-200',
  'hover:bg-blue-600',
  'hover:text-white',
  'focus:outline-none',
  'focus:ring-2',
  'focus:ring-blue-500',
  'md:grid-cols-2',
  'lg:grid-cols-4',
  'dark:bg-slate-900',
  'dark:text-slate-100',
  'w-[calc(100%-1rem)]',
  'text-[13px]',
  'bg-[#123456]',
  'before:content-["bench"]',
]

const noiseTokens = [
  'https://example.test/api/v1',
  'application/json',
  'tailwindcss-mangle',
  'definitely-not-a-tailwind-class',
  'Content-Type',
  'GET',
  'POST',
]

function intFromEnv(name: string, fallback: number) {
  const value = process.env[name]
  if (!value) {
    return fallback
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function resolveProfile(): BenchProfile {
  const scale = process.env.TWM_ENGINE_BENCH_SCALE ?? 'default'
  const defaults: Record<string, BenchProfile> = {
    small: {
      filesPerExtension: 2,
      blocksPerFile: 60,
      warmups: 1,
      iterations: 2,
    },
    default: {
      filesPerExtension: 2,
      blocksPerFile: 150,
      warmups: 1,
      iterations: 3,
    },
    large: {
      filesPerExtension: 4,
      blocksPerFile: 300,
      warmups: 1,
      iterations: 3,
    },
  }
  const selected = defaults[scale] ?? defaults.default
  return {
    filesPerExtension: intFromEnv('TWM_ENGINE_BENCH_FILES_PER_EXTENSION', selected.filesPerExtension),
    blocksPerFile: intFromEnv('TWM_ENGINE_BENCH_BLOCKS_PER_FILE', selected.blocksPerFile),
    warmups: intFromEnv('TWM_ENGINE_BENCH_WARMUPS', selected.warmups),
    iterations: intFromEnv('TWM_ENGINE_BENCH_ITERATIONS', selected.iterations),
  }
}

function rotate<T>(items: readonly T[], index: number) {
  return items[index % items.length] as T
}

function classBundle(seed: number, width = 14) {
  const classes: string[] = []
  for (let i = 0; i < width; i++) {
    classes.push(rotate(validCandidates, seed * 7 + i * 5))
  }
  return classes.join(' ')
}

function noiseBundle(seed: number) {
  return [
    rotate(noiseTokens, seed),
    rotate(noiseTokens, seed + 2),
    rotate(noiseTokens, seed + 4),
  ].join(' ')
}

function generateHtml(blocks: number, fileIndex: number) {
  const lines = ['<!doctype html>', '<html>', '<body>', '<main class="min-h-screen bg-slate-50">']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(
      `<section class="${classBundle(seed)}" data-noise="${noiseBundle(seed)}">`,
      `  <button class="${classBundle(seed + 1, 10)}" hover-class="hover:bg-blue-600">Action ${seed}</button>`,
      `  <p class="${classBundle(seed + 2, 8)}">Benchmark ${seed}</p>`,
      '</section>',
    )
  }
  lines.push('</main>', '</body>', '</html>')
  return lines.join('\n')
}

function generateVue(blocks: number, fileIndex: number) {
  const template = ['<template>', '  <main class="min-h-screen bg-white">']
  const script = ['<script setup lang="ts">', 'const activeClass = "text-blue-500 font-semibold"', 'const inactiveClass = "text-slate-700"', 'const rows = [']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    template.push(
      `    <article class="${classBundle(seed)}" :class="[activeClass, ${i % 2 === 0 ? 'inactiveClass' : 'undefined'}]">`,
      `      <span class="${classBundle(seed + 1, 8)}">{{ rows[${i}]?.label }}</span>`,
      '    </article>',
    )
    script.push(`  { label: "Row ${seed}", className: "${classBundle(seed + 2, 8)}", note: "${noiseBundle(seed)}" },`)
  }
  template.push('  </main>', '</template>')
  script.push(']', '</script>', '<style scoped>', '.bench-card { @apply rounded-lg border border-slate-200 p-4 shadow-sm; }', '</style>')
  return [...template, ...script].join('\n')
}

function generateScript(blocks: number, fileIndex: number, extension: 'js' | 'ts') {
  const lines = extension === 'ts'
    ? ['type BenchRow = { id: number, className: string, meta: string }', 'export const rows: BenchRow[] = [']
    : ['export const rows = [']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(`  { id: ${seed}, className: "${classBundle(seed)}", meta: "${noiseBundle(seed)}" },`)
  }
  lines.push(']')
  lines.push('export function resolveRowClass(index) {')
  lines.push('  return rows[index % rows.length].className + " hover:bg-blue-600 focus:ring-2"')
  lines.push('}')
  return lines.join('\n')
}

function generateJsx(blocks: number, fileIndex: number, extension: 'jsx' | 'tsx') {
  const lines = [
    'import React from "react"',
    extension === 'tsx' ? 'interface Item { id: number, className: string, label: string }' : '',
    extension === 'tsx' ? 'const items: Item[] = [' : 'const items = [',
  ].filter(Boolean)
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(`  { id: ${seed}, className: "${classBundle(seed)}", label: "Item ${seed}" },`)
  }
  lines.push(']')
  lines.push('export function BenchList() {')
  lines.push('  return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">')
  lines.push('    {items.map(item => <article key={item.id} className={item.className + " transition duration-200"}><span className="text-sm font-medium">{item.label}</span></article>)}')
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(`    <section className="${classBundle(seed)}" data-noise="${noiseBundle(seed)}">`)
    lines.push(`      <button className="${classBundle(seed + 1, 8)}" type="button">Action ${seed}</button>`)
    lines.push(`      <p className="${classBundle(seed + 2, 8)}">Benchmark {${seed}}</p>`)
    lines.push('    </section>')
  }
  lines.push('  </div>')
  lines.push('}')
  return lines.join('\n')
}

function generateWxml(blocks: number, fileIndex: number) {
  const lines = ['<view class="min-h-screen bg-slate-50">']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(
      `  <view class="${classBundle(seed)}" hover-class="hover:bg-blue-600">`,
      `    <text class="${classBundle(seed + 1, 8)}">Mini app ${seed}</text>`,
      '  </view>',
    )
  }
  lines.push('</view>')
  return lines.join('\n')
}

function generateCss(blocks: number, fileIndex: number) {
  const lines = ['@tailwind utilities;']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(
      `.bench-${seed} {`,
      `  @apply ${classBundle(seed, 10)};`,
      `  content: "${noiseBundle(seed)}";`,
      '}',
    )
  }
  return lines.join('\n')
}

function generateSvelte(blocks: number, fileIndex: number) {
  const lines = ['<script lang="ts">', '  const active = "text-blue-500 font-semibold"', '</script>', '<main class="min-h-screen bg-white">']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(
      `  <section class="${classBundle(seed)} {active}">`,
      `    <span class="${classBundle(seed + 1, 8)}">Svelte ${seed}</span>`,
      '  </section>',
    )
  }
  lines.push('</main>')
  return lines.join('\n')
}

function generateAstro(blocks: number, fileIndex: number) {
  const lines = ['---', 'const activeClass = "text-blue-500 font-semibold"', '---', '<main class="min-h-screen bg-white">']
  for (let i = 0; i < blocks; i++) {
    const seed = fileIndex * blocks + i
    lines.push(
      `  <article class="${classBundle(seed)} {activeClass}">`,
      `    <span class="${classBundle(seed + 1, 8)}">Astro ${seed}</span>`,
      '  </article>',
    )
  }
  lines.push('</main>')
  return lines.join('\n')
}

function generateContent(extension: string, blocks: number, fileIndex: number) {
  switch (extension) {
    case 'html':
      return generateHtml(blocks, fileIndex)
    case 'vue':
      return generateVue(blocks, fileIndex)
    case 'js':
      return generateScript(blocks, fileIndex, 'js')
    case 'ts':
      return generateScript(blocks, fileIndex, 'ts')
    case 'jsx':
      return generateJsx(blocks, fileIndex, 'jsx')
    case 'tsx':
      return generateJsx(blocks, fileIndex, 'tsx')
    case 'wxml':
      return generateWxml(blocks, fileIndex)
    case 'css':
      return generateCss(blocks, fileIndex)
    case 'svelte':
      return generateSvelte(blocks, fileIndex)
    case 'astro':
      return generateAstro(blocks, fileIndex)
    default:
      throw new Error(`Unsupported extension: ${extension}`)
  }
}

async function prepareDataset(profile: BenchProfile): Promise<DatasetSummary> {
  await fs.rm(generatedRoot, { recursive: true, force: true })
  await fs.mkdir(generatedRoot, { recursive: true })

  const files: GeneratedFile[] = []
  for (const extension of extensions) {
    const dir = path.join(generatedRoot, extension)
    await fs.mkdir(dir, { recursive: true })
    for (let i = 0; i < profile.filesPerExtension; i++) {
      const file = path.join(dir, `page-${i}.${extension}`)
      const content = generateContent(extension, profile.blocksPerFile, i)
      await fs.writeFile(file, content, 'utf8')
      files.push({
        file,
        extension,
        bytes: Buffer.byteLength(content),
        blocks: profile.blocksPerFile,
      })
    }
  }

  return {
    root: generatedRoot,
    files,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    totalBlocks: files.reduce((total, file) => total + file.blocks, 0),
  }
}

function sourceEntries(root: string): SourceEntry[] {
  return extensions.map(extension => ({
    base: root,
    pattern: `${extension}/**/*.${extension}`,
    negated: false,
  }))
}

async function time<T>(fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start = performance.now()
  const value = await fn()
  return {
    durationMs: performance.now() - start,
    value,
  }
}

function percentile(sorted: number[], ratio: number) {
  if (sorted.length === 0) {
    return 0
  }
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index] ?? 0
}

function summarizeSamples(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    minMs: sorted[0] ?? 0,
    meanMs: total / sorted.length,
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  }
}

async function benchmark<T>(
  scenario: string,
  profile: BenchProfile,
  fn: () => Promise<T>,
  details: (value: T) => Record<string, string | number>,
  bytes?: number,
): Promise<BenchResult> {
  let latest: T | undefined
  for (let i = 0; i < profile.warmups; i++) {
    latest = await fn()
  }

  const samples: number[] = []
  for (let i = 0; i < profile.iterations; i++) {
    ;(globalThis as { gc?: () => void }).gc?.()
    const result = await time(fn)
    samples.push(result.durationMs)
    latest = result.value
  }

  if (latest === undefined) {
    latest = await fn()
  }
  const summary = summarizeSamples(samples)
  return {
    scenario,
    samples: samples.length,
    ...summary,
    throughputMbPerSecond: bytes && summary.meanMs > 0
      ? bytes / 1024 / 1024 / (summary.meanMs / 1_000)
      : undefined,
    details: details(latest),
  }
}

function averagePhaseSamples(samples: Array<Record<string, number>>) {
  const result: Record<string, number> = {}
  for (const sample of samples) {
    for (const [phase, duration] of Object.entries(sample)) {
      result[phase] = (result[phase] ?? 0) + duration
    }
  }
  for (const phase of Object.keys(result)) {
    result[phase] = (result[phase] ?? 0) / samples.length
  }
  return result
}

async function benchmarkPhases<T>(
  scenario: string,
  profile: BenchProfile,
  fn: () => Promise<{ phases: Record<string, number>, value: T }>,
  details: (value: T) => Record<string, string | number>,
): Promise<PhaseBenchResult> {
  let latest: T | undefined
  for (let i = 0; i < profile.warmups; i++) {
    latest = (await fn()).value
  }

  const samples: Array<Record<string, number>> = []
  for (let i = 0; i < profile.iterations; i++) {
    ;(globalThis as { gc?: () => void }).gc?.()
    const result = await fn()
    samples.push(result.phases)
    latest = result.value
  }

  if (latest === undefined) {
    latest = (await fn()).value
  }

  return {
    scenario,
    samples: samples.length,
    phases: averagePhaseSamples(samples),
    details: details(latest),
  }
}

function groupByExtension(files: GeneratedFile[]) {
  const groups = new Map<string, GeneratedFile[]>()
  for (const file of files) {
    const group = groups.get(file.extension) ?? []
    group.push(file)
    groups.set(file.extension, group)
  }
  return groups
}

async function runContentExtractionBenchmarks(dataset: DatasetSummary, profile: BenchProfile) {
  const results: BenchResult[] = []
  for (const [extension, files] of groupByExtension(dataset.files)) {
    const loaded = await Promise.all(files.map(async file => ({
      ...file,
      content: await fs.readFile(file.file, 'utf8'),
    })))
    const bytes = loaded.reduce((total, file) => total + file.bytes, 0)
    results.push(await benchmark(
      `extractSourceCandidatesWithPositions .${extension}`,
      profile,
      async () => {
        let candidates = 0
        for (const file of loaded) {
          candidates += (await extractSourceCandidatesWithPositions(file.content, extension, {
            bareArbitraryValues: true,
          })).length
        }
        return candidates
      },
      candidates => ({
        files: loaded.length,
        candidates,
      }),
      bytes,
    ))
  }
  return results
}

async function runProjectBenchmarks(dataset: DatasetSummary, profile: BenchProfile) {
  const sources = sourceEntries(dataset.root)
  const engineSource = await resolveTailwindV4Source({
    projectRoot: packageRoot,
    base: tailwindNodeBase,
    css: '@import "tailwindcss";',
  })
  const engine = createTailwindV4Engine(engineSource)

  return [
    await benchmark(
      'extractRawCandidates filesystem scan',
      profile,
      () => extractRawCandidates(sources, { bareArbitraryValues: true }),
      candidates => ({
        files: dataset.files.length,
        candidates: candidates.length,
      }),
      dataset.totalBytes,
    ),
    await benchmark(
      'extractProjectCandidatesWithPositions metadata scan',
      profile,
      () => extractProjectCandidatesWithPositions({
        cwd: dataset.root,
        sources,
      }),
      report => ({
        files: report.filesScanned,
        entries: report.entries.length,
      }),
      dataset.totalBytes,
    ),
    await benchmark(
      'extractValidCandidates filesystem scan',
      profile,
      () => extractValidCandidates({
        cwd: dataset.root,
        base: tailwindNodeBase,
        css: '@import "tailwindcss";',
        bareArbitraryValues: true,
        sources,
      }),
      candidates => ({
        files: dataset.files.length,
        validCandidates: candidates.length,
      }),
      dataset.totalBytes,
    ),
    await benchmark(
      'createTailwindV4Engine.generate scanSources',
      profile,
      () => engine.generate({
        bareArbitraryValues: true,
        scanSources: sources,
      }),
      result => ({
        rawCandidates: result.rawCandidates.size,
        classSet: result.classSet.size,
        cssKb: (Buffer.byteLength(result.css) / 1024).toFixed(1),
      }),
      dataset.totalBytes,
    ),
  ]
}

async function runExtractValidCandidatesPhases(dataset: DatasetSummary, profile: BenchProfile): Promise<PhaseBenchResult> {
  const sources = sourceEntries(dataset.root)
  const source = await resolveTailwindV4Source({
    projectRoot: packageRoot,
    base: tailwindNodeBase,
    css: '@import "tailwindcss";',
  })

  return benchmarkPhases(
    'extractValidCandidates phase breakdown',
    profile,
    async () => {
      const phases: Record<string, number> = {}
      const designSystemResult = await time(() => loadTailwindV4DesignSystem(source))
      phases.loadDesignSystemMs = designSystemResult.durationMs

      const rawCandidatesResult = await time(() => extractRawCandidates(sources, { bareArbitraryValues: true }))
      phases.scanRawCandidatesMs = rawCandidatesResult.durationMs

      const inlineSourcesResult = await time(async () => extractTailwindV4InlineSourceCandidates(source.css))
      phases.inlineSourcesMs = inlineSourcesResult.durationMs

      const candidates = new Set(rawCandidatesResult.value)
      for (const candidate of inlineSourcesResult.value.included) {
        candidates.add(candidate)
      }
      for (const candidate of inlineSourcesResult.value.excluded) {
        candidates.delete(candidate)
      }

      const validateResult = await time(async () => resolveValidTailwindV4Candidates(
        designSystemResult.value,
        candidates,
        { bareArbitraryValues: true },
      ))
      phases.validateCandidatesMs = validateResult.durationMs

      return {
        phases,
        value: {
          rawCandidates: rawCandidatesResult.value.length,
          validCandidates: validateResult.value.size,
        },
      }
    },
    value => ({
      rawCandidates: value.rawCandidates,
      validCandidates: value.validCandidates,
    }),
  )
}

async function runEngineGeneratePhases(dataset: DatasetSummary, profile: BenchProfile): Promise<PhaseBenchResult> {
  const sources = sourceEntries(dataset.root)
  const source = await resolveTailwindV4Source({
    projectRoot: packageRoot,
    base: tailwindNodeBase,
    css: '@import "tailwindcss";',
  })

  return benchmarkPhases(
    'createTailwindV4Engine.generate phase breakdown',
    profile,
    async () => {
      const phases: Record<string, number> = {}
      const compileResult = await time(() => compileTailwindV4Source(source))
      phases.compileMs = compileResult.durationMs

      const rawCandidatesResult = await time(async () => {
        const rawCandidates = new Set<string>()
        for (const candidate of await extractRawCandidates(sources, { bareArbitraryValues: true })) {
          rawCandidates.add(candidate)
        }
        const inlineSources = extractTailwindV4InlineSourceCandidates(source.css)
        for (const candidate of inlineSources.included) {
          rawCandidates.add(candidate)
        }
        for (const candidate of inlineSources.excluded) {
          rawCandidates.delete(candidate)
        }
        return rawCandidates
      })
      phases.collectRawCandidatesMs = rawCandidatesResult.durationMs

      const designSystemResult = await time(() => loadTailwindV4DesignSystem(source))
      phases.loadDesignSystemMs = designSystemResult.durationMs

      const validateResult = await time(async () => resolveValidTailwindV4Candidates(
        designSystemResult.value,
        rawCandidatesResult.value,
        { bareArbitraryValues: true },
      ))
      phases.validateCandidatesMs = validateResult.durationMs

      const buildResult = await time(async () => {
        const buildCandidates = canonicalizeBareArbitraryValueCandidates(validateResult.value, true)
        return replaceBareArbitraryValueSelectors(
          compileResult.value.compiled.build(buildCandidates),
          validateResult.value,
          true,
        )
      })
      phases.buildCssMs = buildResult.durationMs

      return {
        phases,
        value: {
          rawCandidates: rawCandidatesResult.value.size,
          classSet: validateResult.value.size,
          cssKb: (Buffer.byteLength(buildResult.value) / 1024).toFixed(1),
        },
      }
    },
    value => ({
      rawCandidates: value.rawCandidates,
      classSet: value.classSet,
      cssKb: value.cssKb,
    }),
  )
}

function formatMs(value: number) {
  return value.toFixed(2)
}

function formatThroughput(value: number | undefined) {
  return value === undefined ? '-' : value.toFixed(1)
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`
  }
  return `${(value / 1024 / 1024).toFixed(2)} MiB`
}

function markdownTable(headers: string[], rows: Array<Array<string | number>>) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function phaseHeaders(phaseResults: PhaseBenchResult[]) {
  const headers: string[] = []
  for (const result of phaseResults) {
    for (const phase of Object.keys(result.phases)) {
      if (!headers.includes(phase)) {
        headers.push(phase)
      }
    }
  }
  return headers
}

async function writeReport(
  dataset: DatasetSummary,
  profile: BenchProfile,
  results: BenchResult[],
  phaseResults: PhaseBenchResult[],
) {
  const byExtension = [...groupByExtension(dataset.files)].map(([extension, files]) => [
    `.${extension}`,
    files.length,
    formatBytes(files.reduce((total, file) => total + file.bytes, 0)),
    files.reduce((total, file) => total + file.blocks, 0),
  ])

  const resultRows = results.map(result => [
    result.scenario,
    result.samples,
    formatMs(result.minMs),
    formatMs(result.meanMs),
    formatMs(result.medianMs),
    formatMs(result.p95Ms),
    formatThroughput(result.throughputMbPerSecond),
    Object.entries(result.details).map(([key, value]) => `${key}=${value}`).join(', '),
  ])
  const phaseColumns = phaseHeaders(phaseResults)
  const phaseRows = phaseResults.map(result => [
    result.scenario,
    result.samples,
    ...phaseColumns.map(phase => formatMs(result.phases[phase] ?? 0)),
    Object.entries(result.details).map(([key, value]) => `${key}=${value}`).join(', '),
  ])

  const sortedByMean = [...results].sort((a, b) => b.meanMs - a.meanMs)
  const slowest = sortedByMean[0]
  const fastest = [...results].sort((a, b) => a.meanMs - b.meanMs)[0]

  const lines = [
    '# @tailwindcss-mangle/engine Benchmark Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Environment',
    '',
    markdownTable(
      ['Item', 'Value'],
      [
        ['Node.js', process.version],
        ['Platform', `${os.platform()} ${os.arch()}`],
        ['CPU', os.cpus()[0]?.model ?? 'unknown'],
        ['CPU cores', os.cpus().length],
        ['Profile', process.env.TWM_ENGINE_BENCH_SCALE ?? 'default'],
        ['Files per extension', profile.filesPerExtension],
        ['Blocks per file', profile.blocksPerFile],
        ['Warmups', profile.warmups],
        ['Iterations', profile.iterations],
      ],
    ),
    '',
    '## Dataset',
    '',
    `Generated root: \`${path.relative(packageRoot, dataset.root)}\``,
    '',
    markdownTable(
      ['Extension', 'Files', 'Bytes', 'Blocks'],
      byExtension,
    ),
    '',
    `Total: ${dataset.files.length} files, ${formatBytes(dataset.totalBytes)}, ${dataset.totalBlocks} generated blocks.`,
    '',
    '## Results',
    '',
    markdownTable(
      ['Scenario', 'Samples', 'Min ms', 'Mean ms', 'Median ms', 'P95 ms', 'MiB/s', 'Details'],
      resultRows,
    ),
    '',
    '## Phase Breakdown',
    '',
    markdownTable(
      ['Scenario', 'Samples', ...phaseColumns, 'Details'],
      phaseRows,
    ),
    '',
    '## Notes',
    '',
    `- Fastest scenario by mean time: ${fastest?.scenario ?? 'n/a'} (${fastest ? formatMs(fastest.meanMs) : '0.00'} ms).`,
    `- Slowest scenario by mean time: ${slowest?.scenario ?? 'n/a'} (${slowest ? formatMs(slowest.meanMs) : '0.00'} ms).`,
    '- Tailwind v4 design-system and module loading caches are in-process caches, so repeated samples reflect warm steady-state behavior after the configured warmup runs.',
    '- Generated fixtures intentionally include valid utilities, arbitrary values, framework-specific class containers, CSS @apply usage, and non-class noise tokens.',
    '',
  ]

  await fs.mkdir(path.dirname(reportFile), { recursive: true })
  await fs.writeFile(reportFile, `${lines.join('\n')}\n`, 'utf8')
}

async function clean() {
  await fs.rm(path.join(benchDir, 'generated'), { recursive: true, force: true })
  await fs.rm(reportFile, { force: true })
  console.log('Removed generated benchmark fixtures and latest report.')
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean()
    return
  }

  const profile = resolveProfile()
  const dataset = await prepareDataset(profile)
  const results = [
    ...await runContentExtractionBenchmarks(dataset, profile),
    ...await runProjectBenchmarks(dataset, profile),
  ]
  const phaseResults = [
    await runExtractValidCandidatesPhases(dataset, profile),
    await runEngineGeneratePhases(dataset, profile),
  ]
  await writeReport(dataset, profile, results, phaseResults)

  console.log(`Generated ${dataset.files.length} benchmark files (${formatBytes(dataset.totalBytes)}) in ${path.relative(packageRoot, dataset.root)}`)
  console.table(results.map(result => ({
    scenario: result.scenario,
    samples: result.samples,
    minMs: formatMs(result.minMs),
    meanMs: formatMs(result.meanMs),
    medianMs: formatMs(result.medianMs),
    p95Ms: formatMs(result.p95Ms),
    mibPerSecond: formatThroughput(result.throughputMbPerSecond),
    details: Object.entries(result.details).map(([key, value]) => `${key}=${value}`).join(', '),
  })))
  const phaseColumns = phaseHeaders(phaseResults)
  console.table(phaseResults.map(result => ({
    scenario: result.scenario,
    samples: result.samples,
    ...Object.fromEntries(phaseColumns.map(phase => [phase, formatMs(result.phases[phase] ?? 0)])),
    details: Object.entries(result.details).map(([key, value]) => `${key}=${value}`).join(', '),
  })))
  console.log(`Report written to ${path.relative(process.cwd(), reportFile)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

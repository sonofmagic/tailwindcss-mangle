import { createRequire } from 'node:module'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  extractProjectCandidatesWithPositions,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
} from '@/extraction/candidate-extractor'

const require = createRequire(import.meta.url)
const fixturesRoot = path.resolve(__dirname, 'fixtures')
const tokenFixturesRoot = path.resolve(fixturesRoot, 'token-scan')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))
const v42FeaturePattern = 'v4/features-4.2.html'

const v42UtilityCandidates = [
  'text-shadow-md',
  'inset-ring-2',
  'field-sizing-content',
  'font-stretch-120%',
  'inline-4',
  'min-inline-8',
  'max-inline-12',
  'block-4',
  'min-block-8',
  'max-block-12',
  'pbs-4',
  'pbe-6',
  'inset-bs-2',
  'inset-be-3',
  'ms-4',
  'me-6',
  'border-s',
  'border-e',
  'rounded-s',
  'rounded-e',
  'start-4',
  'end-4',
  'scheme-dark',
  'text-wrap',
  'text-pretty',
  'text-balance',
  'mask-none',
  'mask-linear-45',
  'mask-radial-at-center',
]

const v42VariantCandidates = [
  'inert:opacity-50',
  'nth-3:bg-red-500',
  'nth-last-2:bg-blue-500',
  'nth-of-type-4:text-green-500',
  'nth-last-of-type-5:underline',
]

describe('candidate extractor', () => {
  it('returns candidate positions for raw content', async () => {
    const html = '<div class="text-blue-500 font-bold"></div>'
    const result = await extractRawCandidatesWithPositions(html)
    const classes = result.map(item => item.rawCandidate)
    expect(classes).toContain('text-blue-500')
    expect(result[0]).toHaveProperty('start')
  })

  it('filters valid Tailwind candidates using design system', async () => {
    const result = await extractValidCandidates({
      base: fixturesRoot,
      sources: [
        {
          base: fixturesRoot,
          pattern: 'hello-world.html',
          negated: false,
        },
      ],
    })

    expect(result).toContain('text-3xl')
    expect(result).toContain('font-bold')
    expect(result).toContain('underline')
  })

  it('ignores HTTP header literals when filtering candidates', async () => {
    const result = await extractValidCandidates({
      base: fixturesRoot,
      sources: [
        {
          base: fixturesRoot,
          pattern: 'http-headers.ts',
          negated: false,
        },
      ],
    })

    expect(result).toContain('text-red-500')
    expect(result).not.toContain('text/event-stream')
    expect(result).not.toContain('text/plain')
    expect(result).not.toContain('text/html')
  })

  it('supports Tailwind v4.2 utility families via @tailwindcss/node', async () => {
    const result = await extractValidCandidates({
      base: tailwindNodeBase,
      sources: [
        {
          base: fixturesRoot,
          pattern: v42FeaturePattern,
          negated: false,
        },
      ],
    })

    expect(result).toEqual(expect.arrayContaining(v42UtilityCandidates))
    expect(result).not.toContain('definitely-not-a-tailwind-class')
  })

  it('supports Tailwind v4.2 structural variants via @tailwindcss/node', async () => {
    const result = await extractValidCandidates({
      base: tailwindNodeBase,
      sources: [
        {
          base: fixturesRoot,
          pattern: v42FeaturePattern,
          negated: false,
        },
      ],
    })

    expect(result).toEqual(expect.arrayContaining(v42VariantCandidates))
  })

  it('falls back to secondary base directories when loading v4.2 design system', async () => {
    const result = await extractValidCandidates({
      base: path.join(fixturesRoot, '__missing-tailwind-base__'),
      baseFallbacks: [tailwindNodeBase],
      sources: [
        {
          base: fixturesRoot,
          pattern: v42FeaturePattern,
          negated: false,
        },
      ],
    })

    expect(result).toEqual(expect.arrayContaining(['text-shadow-md', 'inert:opacity-50']))
  })

  it('accepts @source inline() syntax with extra whitespace in css option', async () => {
    const result = await extractValidCandidates({
      base: tailwindNodeBase,
      css: [
        '@import "tailwindcss";',
        '@source inline(  "text-shadow-md"  );',
        '@source not inline( "text-shadow-2xs" );',
      ].join('\n'),
      sources: [
        {
          base: fixturesRoot,
          pattern: v42FeaturePattern,
          negated: false,
        },
      ],
    })

    expect(result).toContain('text-shadow-md')
    expect(result).toContain('text-pretty')
  })

  it('scans project files for token metadata', async () => {
    const result = await extractProjectCandidatesWithPositions({
      cwd: tokenFixturesRoot,
      sources: [
        {
          base: tokenFixturesRoot,
          pattern: '**/*.{html,tsx}',
          negated: false,
        },
      ],
    })

    expect(result.filesScanned).toBe(2)
    expect(result.entries.length).toBeGreaterThan(0)

    const htmlMatch = result.entries.find(
      entry => entry.relativeFile.endsWith('page.html') && entry.rawCandidate === 'bg-blue-500',
    )
    const tsxMatch = result.entries.find(
      entry => entry.relativeFile.endsWith('button.tsx') && entry.rawCandidate === 'text-red-500',
    )

    expect(htmlMatch).toBeTruthy()
    expect(htmlMatch?.line).toBeGreaterThan(0)
    expect(htmlMatch?.column).toBeGreaterThan(0)
    expect(tsxMatch?.lineText).toContain('className')
  })

  it('groups token metadata by relative file path', async () => {
    const report = await extractProjectCandidatesWithPositions({
      cwd: tokenFixturesRoot,
      sources: [
        {
          base: tokenFixturesRoot,
          pattern: '**/*.{html,tsx}',
          negated: false,
        },
      ],
    })

    const grouped = groupTokensByFile(report)
    expect(Object.keys(grouped)).toEqual(expect.arrayContaining(['page.html', 'button.tsx']))
    expect(grouped['page.html'].length).toBeGreaterThan(0)
    expect(grouped['button.tsx'][0].relativeFile).toBe('button.tsx')
    expect(grouped['button.tsx'][0].file).toBe('button.tsx')

    const absoluteGrouped = groupTokensByFile(report, { key: 'absolute', stripAbsolutePaths: false })
    const absoluteKey = Object.keys(absoluteGrouped).find(key => key.endsWith('button.tsx'))
    expect(absoluteKey).toBeTruthy()
    if (absoluteKey) {
      expect(absoluteGrouped[absoluteKey][0].file).toBe(absoluteKey)
    }
  })

  it('generates the CLI token command output', async () => {
    const report = await extractProjectCandidatesWithPositions({
      cwd: tokenFixturesRoot,
      sources: [
        {
          base: tokenFixturesRoot,
          pattern: '**/*.{html,tsx}',
          negated: false,
        },
      ],
    })

    const lines = report.entries.map(
      entry => `${entry.relativeFile}:${entry.line}:${entry.column} ${entry.rawCandidate} (${entry.start}-${entry.end})`,
    )

    expect(lines.length).toBeGreaterThan(0)

    const cliCommand = 'pnpm dlx tw-patch tokens --format lines --no-write'
    const preview = `${cliCommand}\n${lines.join('\n')}`

    expect(preview.startsWith(cliCommand)).toBe(true)
    expect(preview.split('\n').length).toBe(lines.length + 1)
  })
})

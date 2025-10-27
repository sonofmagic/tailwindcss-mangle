import path from 'pathe'
import { describe, expect, it } from 'vitest'
import {
  extractProjectCandidatesWithPositions,
  extractRawCandidatesWithPositions,
  extractValidCandidates,
  groupTokensByFile,
} from '@/extraction/candidate-extractor'

const fixturesRoot = path.resolve(__dirname, 'fixtures')
const tokenFixturesRoot = path.resolve(fixturesRoot, 'token-scan')

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

  it('prints the CLI token command output', async () => {
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

    // Mirror the CLI output to demonstrate `pnpm dlx tw-patch tokens --format lines`.
    console.log('pnpm dlx tw-patch tokens --format lines --no-write')
    console.log(lines.join('\n'))
  })
})

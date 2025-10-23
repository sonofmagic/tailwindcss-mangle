import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { extractRawCandidatesWithPositions, extractValidCandidates } from '@/extraction/candidate-extractor'

const fixturesRoot = path.resolve(__dirname, 'fixtures')

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
})

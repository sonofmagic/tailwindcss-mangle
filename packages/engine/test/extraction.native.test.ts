import { describe, expect, it } from 'vitest'
import { extractSourceCandidatesWithPositions } from '@/extraction/candidate-extractor'
import { createJsStringSourceSegments } from '@/extraction/js-string-ranges'
import { resolveLineMetas } from '@/extraction/project-report'
import { extractBatchedSourceSegmentCandidates } from '@/extraction/segments'
import { filterSourceCandidates } from '@/extraction/source-filters'
import { splitCandidateTokens } from '@/extraction/split-candidate-tokens'
import { escapeCssClassName, extractBareArbitraryValueSourceCandidatesWithPositions, resolveBareArbitraryValueCandidates } from '@/v4/bare-arbitrary-values'

describe('native extraction boundary', () => {
  it('keeps JavaScript UTF-16 offsets across astral and non-Latin source text', () => {
    const source = 'const title = "😀中文";\nconst classes = "p-10px text-red-500"'
    const start = source.indexOf('p-10px')
    const candidates = extractBareArbitraryValueSourceCandidatesWithPositions(source, true)
    expect(candidates).toEqual([{ rawCandidate: 'p-10px', start, end: start + 6 }])
    expect(createJsStringSourceSegments(source, 3)).toEqual([
      { content: '😀中文', start: source.indexOf('😀') + 3 },
      { content: 'p-10px text-red-500', start: start + 3 },
    ])
    expect(resolveLineMetas(source, [source.indexOf('😀'), start])).toEqual([
      { line: 1, column: source.indexOf('😀') + 1, lineText: 'const title = "😀中文";' },
      { line: 2, column: 'const classes = "'.length + 1, lineText: 'const classes = "p-10px text-red-500"' },
    ])
    expect(escapeCssClassName('😀中文:foo')).toBe('😀中文\\:foo')
  })

  it('filters a batch without losing candidate order or source context', () => {
    const source = '<view class="p-10px"><span>text-red-500</span></view>'
    const candidates = ['class', 'p-10px', 'text-red-500'].map(rawCandidate => ({
      rawCandidate,
      start: source.indexOf(rawCandidate),
      end: source.indexOf(rawCandidate) + rawCandidate.length,
    }))
    expect(filterSourceCandidates(source, 'html', candidates)).toEqual([1])
    const css = '.x { @apply p-10px; color: red; @apply text-red-500; }'
    expect(filterSourceCandidates(css, 'css', ['p-10px', 'red', 'text-red-500'].map(rawCandidate => ({
      rawCandidate,
      start: css.indexOf(rawCandidate),
      end: css.indexOf(rawCandidate) + rawCandidate.length,
    })))).toEqual([0, 2])
  })

  it('remaps non-ASCII segments and excludes tokens crossing a segment boundary', async () => {
    const segments = [{ content: '😀 p-10px', start: 30 }, { content: '中文 text-red-500', start: 80 }]
    const result = await extractBatchedSourceSegmentCandidates(segments, 'html', async () => [
      { rawCandidate: 'p-10px', start: 3, end: 9 },
      { rawCandidate: 'cross', start: 8, end: 12 },
      { rawCandidate: 'text-red-500', start: 13, end: 25 },
    ])
    expect(result.map(({ rawCandidate, start, end }) => ({ rawCandidate, start, end }))).toEqual([
      { rawCandidate: 'p-10px', start: 33, end: 39 },
      { rawCandidate: 'text-red-500', start: 83, end: 95 },
    ])
  })

  it('resolves bare values in one batch while retaining disabled and invalid entries', () => {
    const candidates = ['hover:!-mt-10px', 'text-var(--brand)', 'aspect-16/9', 'flex', 'content-"😀中文"']
    expect(resolveBareArbitraryValueCandidates(candidates, true).map(value => value?.canonicalCandidate)).toEqual([
      'hover:!-mt-[10px]',
      'text-[color:var(--brand)]',
      'aspect-[16/9]',
      undefined,
      'content-["😀中文"]',
    ])
    expect(resolveBareArbitraryValueCandidates(candidates, false)).toEqual(candidates.map(() => undefined))
    expect(splitCandidateTokens('flex\u00A0before:content-[\'hello world\']\uFEFFtext-red-500\\nblock')).toEqual([
      'flex',
      'before:content-[\'hello world\']',
      'text-red-500',
      'block',
    ])
  })

  it('parses SFC tag boundaries and excludes commented script/style blocks', async () => {
    const source = [
      '😀<!-- <script>"text-fake-100"</script><style>@apply p-99;</style> -->',
      '<template><view class="text-red-500" :class="active && \'font-bold\'" /></template>',
      '<script data-note=">">const classes = "grid-cols-2"</script>',
      '<style data-note=">">/* ignored */ .x { @apply p-4; }</style>',
    ].join('\n')
    const candidates = await extractSourceCandidatesWithPositions(source, 'vue')
    for (const rawCandidate of ['text-red-500', 'font-bold', 'grid-cols-2', 'p-4']) {
      expect(candidates).toContainEqual({
        rawCandidate,
        start: source.indexOf(rawCandidate),
        end: source.indexOf(rawCandidate) + rawCandidate.length,
      })
    }
    expect(candidates.map(candidate => candidate.rawCandidate)).not.toContain('text-fake-100')
    expect(candidates.map(candidate => candidate.rawCandidate)).not.toContain('p-99')
  })

  it('extracts apply rules without reading comments, strings, or custom property blocks', async () => {
    const source = [
      '/* @apply p-99; */',
      '.x { content: "@apply m-99;"; --payload: { @apply gap-99; };',
      '  @apply text-red-500; &:hover { @apply p-4; } }',
    ].join('\n')
    const candidates = await extractSourceCandidatesWithPositions(source, 'css')
    expect(candidates.map(candidate => candidate.rawCandidate)).toEqual(['text-red-500', 'p-4'])
    expect(candidates[0]?.start).toBe(source.indexOf('text-red-500'))
    expect(candidates[1]?.start).toBe(source.indexOf('p-4'))
  })
})

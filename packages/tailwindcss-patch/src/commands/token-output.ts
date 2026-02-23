import type { TailwindTokenByFileMap, TailwindTokenLocation } from '../types'

export type TokenOutputFormat = 'json' | 'lines' | 'grouped-json'
export type TokenGroupKey = 'relative' | 'absolute'

export const TOKEN_FORMATS: TokenOutputFormat[] = ['json', 'lines', 'grouped-json']
export const DEFAULT_TOKEN_REPORT = '.tw-patch/tw-token-report.json'

export function formatTokenLine(entry: TailwindTokenLocation) {
  return `${entry.relativeFile}:${entry.line}:${entry.column} ${entry.rawCandidate} (${entry.start}-${entry.end})`
}

export function formatGroupedPreview(map: TailwindTokenByFileMap, limit: number = 3) {
  const files = Object.keys(map)
  if (!files.length) {
    return { preview: '', moreFiles: 0 }
  }

  const lines = files.slice(0, limit).map((file) => {
    const tokens = map[file] ?? []
    const sample = tokens.slice(0, 3).map(token => token.rawCandidate).join(', ')
    const suffix = tokens.length > 3 ? ', …' : ''
    return `${file}: ${tokens.length} tokens (${sample}${suffix})`
  })

  return {
    preview: lines.join('\n'),
    moreFiles: Math.max(0, files.length - limit),
  }
}

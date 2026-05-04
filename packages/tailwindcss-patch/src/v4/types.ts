export interface TailwindV4SourceOptions {
  projectRoot?: string
  cwd?: string
  base?: string
  baseFallbacks?: string[]
  css?: string
  cssEntries?: string[]
  packageName?: string
}

export interface TailwindV4ResolvedSource {
  projectRoot: string
  base: string
  baseFallbacks: string[]
  css: string
  dependencies: string[]
}

export interface TailwindV4CandidateSource {
  content: string
  extension?: string
}

export interface TailwindV4GenerateOptions {
  candidates?: Iterable<string>
  sources?: TailwindV4CandidateSource[]
}

export interface TailwindV4SourcePattern {
  base: string
  pattern: string
  negated: boolean
}

export interface TailwindV4GenerateResult {
  css: string
  classSet: Set<string>
  rawCandidates: Set<string>
  dependencies: string[]
  sources: TailwindV4SourcePattern[]
  root: null | 'none' | {
    base: string
    pattern: string
  }
}

export interface TailwindV4DesignSystem {
  parseCandidate: (candidate: string) => unknown[]
  candidatesToCss: (candidates: string[]) => Array<string | null | undefined>
}

export interface TailwindV4Engine {
  source: TailwindV4ResolvedSource
  loadDesignSystem: () => Promise<TailwindV4DesignSystem>
  validateCandidates: (candidates: Iterable<string>) => Promise<Set<string>>
  generate: (options?: TailwindV4GenerateOptions) => Promise<TailwindV4GenerateResult>
}

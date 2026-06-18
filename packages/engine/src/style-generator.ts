import type {
  TailwindStyleCandidateOptions,
  TailwindStyleSource,
} from './style-candidates.ts'
import type {
  TailwindV3StyleGenerateOptions,
  TailwindV3StyleGenerateResult,
} from './v3/index.ts'
import type {
  TailwindV4StyleGenerateOptions,
  TailwindV4StyleGenerateResult,
} from './v4/index.ts'
import { collectTailwindStyleCandidates } from './style-candidates.ts'
import { generateTailwindV3Style } from './v3/index.ts'
import { generateTailwindV4Style } from './v4/index.ts'

export interface CustomTailwindStyleGenerateContext {
  tokens: Set<string>
  classSet: Set<string>
  sources: TailwindStyleSource[]
}

export interface CustomTailwindStyleGenerateOptions extends TailwindStyleCandidateOptions {
  generate: (context: CustomTailwindStyleGenerateContext) => string | Promise<string>
}

export interface CustomTailwindStyleGenerateResult {
  version: 'custom'
  css: string
  tokens: Set<string>
  classSet: Set<string>
  sources: TailwindStyleSource[]
}

export type TailwindStyleGenerateOptions
  = | ({ version: 3 } & TailwindV3StyleGenerateOptions)
    | ({ version: 4 } & TailwindV4StyleGenerateOptions)
    | ({ version: 'custom' } & CustomTailwindStyleGenerateOptions)

export type TailwindStyleGenerateResult
  = | TailwindV3StyleGenerateResult
    | (TailwindV4StyleGenerateResult & { version: 4 })
    | CustomTailwindStyleGenerateResult

export async function generateCustomStyle(
  options: CustomTailwindStyleGenerateOptions,
): Promise<CustomTailwindStyleGenerateResult> {
  const tokens = await collectTailwindStyleCandidates(options)
  const classSet = new Set(tokens)
  const sources = options.sources ?? []
  const css = await options.generate({
    tokens,
    classSet,
    sources,
  })

  return {
    version: 'custom',
    css,
    tokens,
    classSet,
    sources,
  }
}

export async function generateTailwindStyle(
  options: TailwindStyleGenerateOptions,
): Promise<TailwindStyleGenerateResult> {
  if (options.version === 3) {
    return generateTailwindV3Style(options)
  }
  if (options.version === 4) {
    const result = await generateTailwindV4Style(options)
    return {
      ...result,
      version: 4,
    }
  }
  return generateCustomStyle(options)
}

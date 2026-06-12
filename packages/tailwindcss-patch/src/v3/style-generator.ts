import type { Node } from 'postcss'
import type { Config } from 'tailwindcss'
import type { TailwindStyleCandidateOptions, TailwindStyleSource } from '../style-candidates'
import type { TailwindcssRuntimeContext } from '../types'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import postcss from 'postcss'
import { collectTailwindStyleCandidates } from '../style-candidates'

type NodeRequire = ReturnType<typeof createRequire>

interface TailwindV3CreateContextModule {
  createContext: (
    tailwindConfig: Config,
    changedContent?: Array<{ content?: string, extension?: string }>,
    root?: ReturnType<typeof postcss.root>,
  ) => TailwindcssRuntimeContext
}

interface TailwindV3GenerateRulesModule {
  generateRules: (
    candidates: Set<string>,
    context: TailwindcssRuntimeContext,
  ) => Array<[unknown, Node]>
}

type ResolveConfig = (config: Config) => Config

interface TailwindV3Offsets {
  sort: <T>(rules: Array<[unknown, T]>) => Array<[{
    layer: 'base' | 'components' | 'defaults' | 'utilities' | 'variants'
  }, T]>
}

export interface TailwindV3StyleGenerateOptions extends TailwindStyleCandidateOptions {
  /**
   * Tailwind v3 package name or alias. Defaults to `tailwindcss`.
   */
  packageName?: string
  /**
   * `createRequire` base used to resolve the Tailwind v3 package.
   */
  cwd?: string
  /**
   * Inline Tailwind v3 config. `content` is injected from collected candidates.
   */
  config?: Partial<Config>
  /**
   * Generate all layers by default. Pass a subset to emit only selected layers.
   */
  layers?: TailwindV3StyleLayer[]
}

export type TailwindV3StyleLayer = 'base' | 'components' | 'utilities' | 'variants'

export interface TailwindV3StyleGenerateResult {
  version: 3
  css: string
  tokens: Set<string>
  classSet: Set<string>
  sources: TailwindStyleSource[]
  config: Config
}

function createPackageRequire(cwd?: string): NodeRequire {
  return createRequire(path.join(path.resolve(cwd ?? process.cwd()), 'package.json'))
}

function createDefaultTailwindV3Config(tokens: Set<string>): Config {
  return {
    content: [
      {
        raw: [...tokens].join(' '),
        extension: 'html',
      },
    ],
    theme: {
      extend: {},
    },
    plugins: [],
  }
}

function loadTailwindV3Modules(options: Pick<TailwindV3StyleGenerateOptions, 'cwd' | 'packageName'>) {
  const packageName = options.packageName ?? 'tailwindcss'
  const moduleRequire = createPackageRequire(options.cwd)
  const resolveConfig = moduleRequire(`${packageName}/resolveConfig`) as ResolveConfig
  const contextModule = moduleRequire(`${packageName}/lib/lib/setupContextUtils`) as TailwindV3CreateContextModule
  const generateRulesModule = moduleRequire(`${packageName}/lib/lib/generateRules`) as TailwindV3GenerateRulesModule
  return {
    createContext: contextModule.createContext,
    generateRules: generateRulesModule.generateRules,
    resolveConfig,
  }
}

function buildStylesheetNodes(
  rules: Array<[unknown, Node]>,
  context: TailwindcssRuntimeContext,
  layers: TailwindV3StyleLayer[],
) {
  const sortedRules = (context.offsets as unknown as TailwindV3Offsets).sort(rules)
  const nodes: Node[] = []
  const layerSet = new Set<TailwindV3StyleLayer>(layers)

  for (const [sort, rule] of sortedRules) {
    const layer = sort.layer === 'defaults' ? 'base' : sort.layer
    if (layerSet.has(layer)) {
      nodes.push(rule.clone())
    }
  }
  return nodes
}

function createRootFromNodes(nodes: Node[]) {
  const root = postcss.root()
  for (const node of nodes) {
    root.append(node)
  }
  return root
}

export async function generateTailwindV3Style(
  options: TailwindV3StyleGenerateOptions = {},
): Promise<TailwindV3StyleGenerateResult> {
  const tokens = await collectTailwindStyleCandidates(options)
  const { createContext, generateRules, resolveConfig } = loadTailwindV3Modules(options)
  const userContent = options.config?.content
  const config = resolveConfig({
    ...createDefaultTailwindV3Config(tokens),
    ...(options.config ?? {}),
    content: [
      ...(Array.isArray(userContent) ? userContent : []),
      {
        raw: [...tokens].join(' '),
        extension: 'html',
      },
    ],
  } as Config)
  const root = postcss.root()
  const context = createContext(config, [], root)
  const rules = generateRules(tokens, context)
  const nodes = buildStylesheetNodes(rules, context, options.layers ?? ['base', 'components', 'utilities', 'variants'])
  const css = createRootFromNodes(nodes).toString()

  return {
    version: 3,
    css,
    tokens,
    classSet: new Set(context.classCache.keys()),
    sources: options.sources ?? [],
    config,
  }
}

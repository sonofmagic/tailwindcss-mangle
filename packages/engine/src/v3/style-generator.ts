import type { Node } from 'postcss'
import type { Config } from 'tailwindcss'
import type { TailwindStyleCandidateOptions, TailwindStyleSource } from '../style-candidates.ts'
import type { TailwindcssRuntimeContext } from '../types.ts'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import postcss from 'postcss'
import { collectTailwindStyleCandidates } from '../style-candidates.ts'

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

interface TailwindV3ProcessResult {
  css: string
  messages: Array<Record<string, unknown>>
}

interface TailwindV3CollapseRulesModule {
  default?: (context: TailwindcssRuntimeContext) => (root: postcss.Root, result: TailwindV3ProcessResult) => void
}

interface TailwindV3ProcessTailwindFeaturesModule {
  default?: (
    setupContext: () => (root: postcss.Root) => TailwindcssRuntimeContext,
  ) => (root: postcss.Root, result: TailwindV3ProcessResult) => Promise<TailwindcssRuntimeContext>
}

interface TailwindV3ResolveDefaultsAtRulesModule {
  default?: (context: TailwindcssRuntimeContext) => (root: postcss.Root, result: TailwindV3ProcessResult) => void
}

interface TailwindV3ValidateConfigModule {
  validateConfig: (config: unknown) => Config
}

interface TailwindV3SharedStateModule {
  NOT_ON_DEMAND?: string
}

type ResolveConfig = (config: Config) => Config

export type TailwindV3ConfigInput = Partial<Config> & {
  content?: unknown
  corePlugins?: unknown
}

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
  config?: TailwindV3ConfigInput
  /**
   * Generate all layers by default. Pass a subset to emit only selected layers.
   */
  layers?: TailwindV3StyleLayer[]
}

export type TailwindV3StyleLayer = 'base' | 'components' | 'utilities' | 'variants'

export interface TailwindV3RawStyleGenerateOptions extends TailwindStyleCandidateOptions {
  /**
   * Tailwind v3 package name or alias. Defaults to `tailwindcss`.
   */
  packageName?: string
  /**
   * `createRequire` base used to resolve the Tailwind v3 package.
   */
  cwd?: string
  /**
   * Tailwind v3 entry CSS. Defaults to `@tailwind utilities;`.
   */
  css?: string
  /**
   * Inline Tailwind v3 config. Candidate content is injected automatically.
   */
  config?: TailwindV3ConfigInput
  /**
   * Directly append generated utility rules when the CSS is exactly `@tailwind utilities;`.
   * This mirrors Tailwind v3's internal fast path and keeps output order aligned.
   */
  directUtilitiesOnly?: boolean | 'auto'
}

export interface TailwindV3RawStyleGenerateResult {
  version: 3
  css: string
  tokens: Set<string>
  classSet: Set<string>
  context: TailwindcssRuntimeContext
  dependencies: string[]
  sources: TailwindStyleSource[]
  config: Config
}

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

export function getDefaultExport<T>(module: { default?: T } | T): T {
  if (module && typeof module === 'object' && 'default' in module) {
    return module.default as T
  }
  return module as T
}

function loadTailwindV3Modules(options: Pick<TailwindV3StyleGenerateOptions, 'cwd' | 'packageName'>) {
  const packageName = options.packageName ?? 'tailwindcss'
  const moduleRequire = createPackageRequire(options.cwd)
  const resolveConfig = getDefaultExport<ResolveConfig>(
    moduleRequire(`${packageName}/lib/public/resolve-config`) as { default?: ResolveConfig } | ResolveConfig,
  )
  const contextModule = moduleRequire(`${packageName}/lib/lib/setupContextUtils`) as TailwindV3CreateContextModule
  const generateRulesModule = moduleRequire(`${packageName}/lib/lib/generateRules`) as TailwindV3GenerateRulesModule
  const collapseAdjacentRulesModule = moduleRequire(`${packageName}/lib/lib/collapseAdjacentRules`) as TailwindV3CollapseRulesModule
  const collapseDuplicateDeclarationsModule = moduleRequire(`${packageName}/lib/lib/collapseDuplicateDeclarations`) as TailwindV3CollapseRulesModule
  const processTailwindFeaturesModule = moduleRequire(`${packageName}/lib/processTailwindFeatures`) as TailwindV3ProcessTailwindFeaturesModule
  const resolveDefaultsAtRulesModule = moduleRequire(`${packageName}/lib/lib/resolveDefaultsAtRules`) as TailwindV3ResolveDefaultsAtRulesModule
  const sharedStateModule = moduleRequire(`${packageName}/lib/lib/sharedState`) as TailwindV3SharedStateModule
  const validateConfigModule = moduleRequire(`${packageName}/lib/util/validateConfig.js`) as TailwindV3ValidateConfigModule
  return {
    collapseAdjacentRules: getDefaultExport(collapseAdjacentRulesModule),
    collapseDuplicateDeclarations: getDefaultExport(collapseDuplicateDeclarationsModule),
    createContext: contextModule.createContext,
    generateRules: generateRulesModule.generateRules,
    notOnDemandCandidate: sharedStateModule.NOT_ON_DEMAND ?? '*',
    processTailwindFeatures: getDefaultExport(processTailwindFeaturesModule),
    resolveDefaultsAtRules: getDefaultExport(resolveDefaultsAtRulesModule),
    resolveConfig,
    validateConfig: validateConfigModule.validateConfig,
  }
}

function createRawContentEntries(candidates: Iterable<string>, sources: TailwindStyleSource[]) {
  const entries: Array<{ raw: string, extension: string }> = []
  const candidateContent = [...candidates].join(' ')
  if (candidateContent.length > 0) {
    entries.push({
      raw: candidateContent,
      extension: 'html',
    })
  }
  for (const source of sources) {
    entries.push({
      raw: source.content,
      extension: source.extension ?? 'html',
    })
  }
  return entries
}

function createChangedContentEntries(candidates: Iterable<string>, sources: TailwindStyleSource[]) {
  return createRawContentEntries(candidates, sources).map(entry => ({
    content: entry.raw,
    extension: entry.extension,
  }))
}

function createTailwindConfigWithContent(
  config: TailwindV3ConfigInput | undefined,
  tokens: Set<string>,
  sources: TailwindStyleSource[],
) {
  const userContent = config?.content
  return {
    ...createDefaultTailwindV3Config(tokens),
    ...(config ?? {}),
    content: [
      ...(Array.isArray(userContent) ? userContent : []),
      ...createRawContentEntries(tokens, sources),
    ],
  } as Config
}

function isDirectUtilitiesOnlyCss(css: string) {
  return css.replace(/\s+/g, '') === '@tailwindutilities;'
}

export function sortCandidates(candidates: Iterable<string>) {
  return [...candidates].sort((a, z) => {
    if (a === z) {
      return 0
    }
    return a < z ? -1 : 1
  })
}

function appendUtilityRules(
  root: postcss.Root,
  context: TailwindcssRuntimeContext,
  rules: Array<[unknown, Node]>,
) {
  const sortedRules = (context.offsets as unknown as TailwindV3Offsets).sort(rules)
  for (const [sort, rule] of sortedRules) {
    const tailwindRaw = rule.raws.tailwind as { parentLayer?: string } | undefined
    if (sort.layer === 'utilities' || (sort.layer === 'variants' && tailwindRaw?.parentLayer === 'utilities')) {
      root.append(rule.clone())
    }
  }
}

function collectClassSet(context: TailwindcssRuntimeContext, notOnDemandCandidate: string) {
  const classSet = new Set<string>()
  for (const candidate of context.classCache.keys()) {
    if (String(candidate) !== String(notOnDemandCandidate)) {
      classSet.add(candidate)
    }
  }
  return classSet
}

export function collectDependencyMessages(result: TailwindV3ProcessResult) {
  const dependencies = new Set<string>()
  for (const message of result.messages) {
    const file = message['file']
    if (message['type'] === 'dependency' && typeof file === 'string') {
      dependencies.add(file)
    }
  }
  return [...dependencies]
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

export async function generateTailwindV3RawStyle(
  options: TailwindV3RawStyleGenerateOptions = {},
): Promise<TailwindV3RawStyleGenerateResult> {
  const tokens = await collectTailwindStyleCandidates(options)
  const {
    collapseAdjacentRules,
    collapseDuplicateDeclarations,
    createContext,
    generateRules,
    notOnDemandCandidate,
    processTailwindFeatures,
    resolveConfig,
    resolveDefaultsAtRules,
    validateConfig,
  } = loadTailwindV3Modules(options)
  const css = options.css ?? '@tailwind utilities;'
  const config = validateConfig(resolveConfig(createTailwindConfigWithContent(options.config, tokens, options.sources ?? [])))
  const root = postcss.parse(css, {
    from: undefined,
  })
  const result: TailwindV3ProcessResult = {
    css: '',
    messages: [],
  }
  const changedContent = createChangedContentEntries(tokens, options.sources ?? [])
  const shouldUseDirectUtilities = options.directUtilitiesOnly === true
    || (options.directUtilitiesOnly !== false && isDirectUtilitiesOnlyCss(css))
  let context: TailwindcssRuntimeContext

  if (shouldUseDirectUtilities) {
    context = createContext(config, changedContent, root)
    generateRules(new Set(sortCandidates([notOnDemandCandidate, ...tokens])), context)
    root.removeAll()
    appendUtilityRules(root, context, [...context.ruleCache])
    resolveDefaultsAtRules(context)(root, result)
    collapseAdjacentRules(context)(root, result)
    collapseDuplicateDeclarations(context)(root, result)
  }
  else {
    let createdContext: TailwindcssRuntimeContext | undefined
    const setupContext = () => {
      return (currentRoot: postcss.Root) => {
        createdContext = createContext(config, changedContent, currentRoot)
        return createdContext
      }
    }
    context = await processTailwindFeatures(setupContext)(root, result) ?? createdContext!
  }

  return {
    version: 3,
    css: root.toString(),
    tokens,
    classSet: collectClassSet(context, notOnDemandCandidate),
    context,
    dependencies: collectDependencyMessages(result),
    sources: options.sources ?? [],
    config,
  }
}

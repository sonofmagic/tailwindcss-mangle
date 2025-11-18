import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'
import type { ILengthUnitsPatchOptions } from '../types'

export type CacheStrategy = 'merge' | 'overwrite'

/**
 * Configures how the Tailwind class cache is stored and where it lives on disk.
 */
export interface CacheUserOptions {
  /** Whether caching is enabled. */
  enabled?: boolean
  /** Working directory used when resolving cache paths. */
  cwd?: string
  /** Directory where cache files are written. */
  dir?: string
  /**
   * Cache filename. Defaults to `class-cache.json` inside the derived cache folder
   * when omitted.
   */
  file?: string
  /** Strategy used when merging new class lists with an existing cache. */
  strategy?: CacheStrategy
}

/**
 * Controls how extracted class lists are written to disk.
 */
export interface OutputUserOptions {
  /** Whether to produce an output file. */
  enabled?: boolean
  /** Optional absolute or relative path to the output file. */
  file?: string
  /** Output format, defaults to JSON when omitted. */
  format?: 'json' | 'lines'
  /** Pretty-print spacing (truthy value enables indentation). */
  pretty?: number | boolean
  /** Whether to strip the universal selector (`*`) from the final list. */
  removeUniversalSelector?: boolean
}

/**
 * Options controlling how Tailwind contexts are exposed during runtime patching.
 */
export interface ExposeContextUserOptions {
  /** Name of the property used to reference an exposed context. */
  refProperty?: string
}

/**
 * Extends the built-in length-unit patch with custom defaults.
 */
export interface ExtendLengthUnitsUserOptions extends Partial<ILengthUnitsPatchOptions> {
  /** Enables or disables the length-unit patch. */
  enabled?: boolean
}

/**
 * Feature switches that toggle optional Tailwind patch capabilities.
 */
export interface FeatureUserOptions {
  /** Whether to expose runtime Tailwind contexts (or configure how they are exposed). */
  exposeContext?: boolean | ExposeContextUserOptions
  /** Extends the length-unit patch or disables it entirely. */
  extendLengthUnits?: false | ExtendLengthUnitsUserOptions
}

/**
 * Shared configuration used for Tailwind v2/v3 patching flows.
 */
export interface TailwindConfigUserOptions {
  /** Path to a Tailwind config file when auto-detection is insufficient. */
  config?: string
  /** Custom working directory used when resolving config-relative paths. */
  cwd?: string
  /** Optional PostCSS plugin name to use instead of the default. */
  postcssPlugin?: string
}

/**
 * Additional configuration specific to Tailwind CSS v4 extraction.
 */
export interface TailwindV4UserOptions {
  /** Base directory used when resolving v4 content sources and configs. */
  base?: string
  /** Raw CSS passed directly to the v4 design system. */
  css?: string
  /** Set of CSS entry files that should be scanned for `@config` directives. */
  cssEntries?: string[]
  /** Overrides the content sources scanned by the oxide scanner. */
  sources?: SourceEntry[]
}

/**
 * High-level Tailwind patch configuration shared across versions.
 */
export interface TailwindUserOptions extends TailwindConfigUserOptions {
  /**
   * Optional hint for picking the patch strategy.
   * When omitted we infer from the installed Tailwind CSS package version.
   */
  version?: 2 | 3 | 4
  /** Tailwind package name if the project uses a fork. */
  packageName?: string
  /** Package resolution options forwarded to `local-pkg`. */
  resolve?: PackageResolvingOptions
  /** Overrides applied when patching Tailwind CSS v2. */
  v2?: TailwindConfigUserOptions
  /** Overrides applied when patching Tailwind CSS v3. */
  v3?: TailwindConfigUserOptions
  /** Options specific to Tailwind CSS v4 patching. */
  v4?: TailwindV4UserOptions
}

/**
 * Root configuration consumed by the Tailwind CSS patch runner.
 */
export interface TailwindcssPatchOptions {
  /**
   * Base directory used when resolving Tailwind resources.
   * Defaults to `process.cwd()`.
   */
  cwd?: string
  /** Whether to overwrite generated artifacts (e.g., caches, outputs). */
  overwrite?: boolean
  /** Tailwind-specific configuration grouped by major version. */
  tailwind?: TailwindUserOptions
  /** Feature toggles for optional helpers. */
  features?: FeatureUserOptions
  /** Optional function that filters final class names. */
  filter?: (className: string) => boolean
  /** Cache configuration or boolean to enable/disable quickly. */
  cache?: boolean | CacheUserOptions
  /** Output configuration or boolean to inherits defaults. */
  output?: OutputUserOptions
}

/**
 * Stable shape for output configuration after normalization.
 */
export interface NormalizedOutputOptions {
  enabled: boolean
  file?: string
  format: 'json' | 'lines'
  pretty: number | false
  removeUniversalSelector: boolean
}

/**
 * Stable cache configuration used internally after defaults are applied.
 */
export interface NormalizedCacheOptions {
  enabled: boolean
  cwd: string
  dir: string
  file: string
  path: string
  strategy: CacheStrategy
}

/** Tracks whether runtime contexts should be exposed and via which property. */
export interface NormalizedExposeContextOptions {
  enabled: boolean
  refProperty: string
}

/** Normalized representation of the extend-length-units feature flag. */
export interface NormalizedExtendLengthUnitsOptions extends ILengthUnitsPatchOptions {
  enabled: boolean
}

/** Normalized Tailwind v4 configuration consumed by runtime helpers. */
export interface NormalizedTailwindV4Options {
  base: string
  configuredBase?: string
  css?: string
  cssEntries: string[]
  sources: SourceEntry[]
  hasUserDefinedSources: boolean
}

/**
 * Tailwind configuration ready for consumption by the runtime after normalization.
 */
export interface NormalizedTailwindConfigOptions extends TailwindConfigUserOptions {
  packageName: string
  versionHint?: 2 | 3 | 4
  resolve?: PackageResolvingOptions
  v2?: TailwindConfigUserOptions
  v3?: TailwindConfigUserOptions
  v4?: NormalizedTailwindV4Options
}

/** Grouped normalized feature flags. */
export interface NormalizedFeatureOptions {
  exposeContext: NormalizedExposeContextOptions
  extendLengthUnits: NormalizedExtendLengthUnitsOptions | null
}

/** Final normalized shape consumed throughout the patch runtime. */
export interface NormalizedTailwindcssPatchOptions {
  projectRoot: string
  overwrite: boolean
  tailwind: NormalizedTailwindConfigOptions
  features: NormalizedFeatureOptions
  output: NormalizedOutputOptions
  cache: NormalizedCacheOptions
  filter: (className: string) => boolean
}

import type { SourceEntry } from '@tailwindcss/oxide'
import type { PackageResolvingOptions } from 'local-pkg'
import type { ILengthUnitsPatchOptions } from '../types'

export type CacheStrategy = 'merge' | 'overwrite'
export type CacheDriver = 'file' | 'memory' | 'noop'

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
  /** Backend used to persist the cache (`file`, `memory`, or `noop`). Defaults to `file`. */
  driver?: CacheDriver
}

/**
 * Preferred options for extraction output behavior.
 */
export interface TailwindExtractionUserOptions {
  /** Whether to produce an output file. */
  write?: boolean
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
 * @deprecated Use `TailwindExtractionUserOptions`.
 * Legacy output options kept for backward compatibility and will be removed in the next major version.
 */
export interface OutputUserOptions {
  /** @deprecated Use `extract.write` instead. */
  enabled?: boolean
  /** @deprecated Use `extract.file` instead. */
  file?: string
  /** @deprecated Use `extract.format` instead. */
  format?: 'json' | 'lines'
  /** @deprecated Use `extract.pretty` instead. */
  pretty?: number | boolean
  /** @deprecated Use `extract.removeUniversalSelector` instead. */
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
 * Preferred options for runtime patch behavior.
 */
export interface PatchApplyUserOptions {
  /** Whether patched files can be overwritten on disk. */
  overwrite?: boolean
  /** Whether to expose runtime Tailwind contexts (or configure how they are exposed). */
  exposeContext?: boolean | ExposeContextUserOptions
  /** Extends the length-unit patch or disables it entirely. */
  extendLengthUnits?: false | ExtendLengthUnitsUserOptions
}

/**
 * @deprecated Use `PatchApplyUserOptions`.
 * Legacy nested feature options kept for backward compatibility and will be removed in the next major version.
 */
export interface FeatureUserOptions {
  /** @deprecated Use `apply.exposeContext` instead. */
  exposeContext?: boolean | ExposeContextUserOptions
  /** @deprecated Use `apply.extendLengthUnits` instead. */
  extendLengthUnits?: false | ExtendLengthUnitsUserOptions
}

/**
 * Shared configuration used for Tailwind v2/v3 patching flows.
 */
export interface TailwindRuntimeConfigUserOptions {
  /** Path to a Tailwind config file when auto-detection is insufficient. */
  config?: string
  /** Custom working directory used when resolving config-relative paths. */
  cwd?: string
  /** Optional PostCSS plugin name to use instead of the default. */
  postcssPlugin?: string
}

/**
 * @deprecated Use `TailwindRuntimeConfigUserOptions`.
 * Legacy naming kept for backward compatibility and will be removed in the next major version.
 */
export interface TailwindConfigUserOptions extends TailwindRuntimeConfigUserOptions {}

/**
 * Additional configuration specific to Tailwind CSS v4 extraction.
 */
export interface TailwindV4RuntimeUserOptions {
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
 * @deprecated Use `TailwindV4RuntimeUserOptions`.
 * Legacy naming kept for backward compatibility and will be removed in the next major version.
 */
export interface TailwindV4UserOptions extends TailwindV4RuntimeUserOptions {}

/**
 * High-level Tailwind patch configuration shared across versions.
 */
export interface TailwindcssUserOptions extends TailwindRuntimeConfigUserOptions {
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
  v2?: TailwindRuntimeConfigUserOptions
  /** Overrides applied when patching Tailwind CSS v3. */
  v3?: TailwindRuntimeConfigUserOptions
  /** Options specific to Tailwind CSS v4 patching. */
  v4?: TailwindV4RuntimeUserOptions
}

/**
 * @deprecated Use `TailwindcssUserOptions`.
 * Legacy naming kept for backward compatibility and will be removed in the next major version.
 */
export interface TailwindUserOptions extends TailwindcssUserOptions {}

/**
 * Root configuration consumed by the Tailwind CSS patch runner.
 */
export interface TailwindcssPatchOptions {
  /**
   * Base directory used when resolving Tailwind resources.
   * Defaults to `process.cwd()`.
   */
  projectRoot?: string
  /** Preferred Tailwind runtime configuration. */
  tailwindcss?: TailwindcssUserOptions
  /** Preferred patch toggles. */
  apply?: PatchApplyUserOptions
  /** Preferred extraction output settings. */
  extract?: TailwindExtractionUserOptions
  /** Optional function that filters final class names. */
  filter?: (className: string) => boolean
  /** Cache configuration or boolean to enable/disable quickly. */
  cache?: boolean | CacheUserOptions

  /**
   * Base directory used when resolving Tailwind resources.
   * Defaults to `process.cwd()`.
   * @deprecated Use `projectRoot` instead.
   */
  cwd?: string
  /**
   * Whether to overwrite generated artifacts (e.g., caches, outputs).
   * @deprecated Use `apply.overwrite` instead.
   */
  overwrite?: boolean
  /** @deprecated Use `tailwindcss` instead. */
  tailwind?: TailwindUserOptions
  /** @deprecated Use `apply` instead. */
  features?: FeatureUserOptions
  /** @deprecated Use `extract` instead. */
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
  driver: CacheDriver
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

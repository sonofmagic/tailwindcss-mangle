export { fromUnifiedConfig } from '../options/legacy'
export { normalizeOptions } from '../options/normalize'
export type {
  ApplyOptions,
  CacheOptions,
  CacheStrategy,
  ExposeContextOptions,
  ExtendLengthUnitsOptions,
  ExtractOptions,
  NormalizedCacheOptions,
  NormalizedExtendLengthUnitsOptions,
  NormalizedTailwindCssPatchOptions,
  TailwindCssOptions,
  TailwindCssPatchOptions,
  TailwindV2Options,
  TailwindV3Options,
  TailwindV4Options,
} from '../options/types'
export {
  loadPatchOptionsForWorkspace,
  loadWorkspaceConfigModule,
  loadWorkspaceDefu,
  type TailwindcssConfigModule,
  type TailwindcssConfigResult,
} from './workspace'

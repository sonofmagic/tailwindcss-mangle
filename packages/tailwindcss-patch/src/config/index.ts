export {
  fromLegacyOptions,
  fromUnifiedConfig,
  type LegacyTailwindcssPatcherOptions,
} from '../options/legacy'
export { normalizeOptions } from '../options/normalize'
export type {
  CacheStrategy,
  ExtendLengthUnitsUserOptions,
  NormalizedCacheOptions,
  NormalizedExtendLengthUnitsOptions,
  NormalizedTailwindcssPatchOptions,
  TailwindcssPatchOptions,
} from '../options/types'
export {
  loadPatchOptionsForWorkspace,
  loadWorkspaceConfigModule,
  loadWorkspaceDefu,
  type TailwindcssConfigModule,
  type TailwindcssConfigResult,
} from './workspace'

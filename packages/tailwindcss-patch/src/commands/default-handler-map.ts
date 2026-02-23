import type { TailwindcssPatchCommand, TailwindcssPatchCommandContext, TailwindcssPatchCommandResultMap } from './types'

import {
  extractCommandDefaultHandler,
  initCommandDefaultHandler,
  installCommandDefaultHandler,
  tokensCommandDefaultHandler,
} from './basic-handlers'
import {
  migrateCommandDefaultHandler,
  restoreCommandDefaultHandler,
  validateCommandDefaultHandler,
} from './migration-handlers'
import { statusCommandDefaultHandler } from './status-handler'

export const defaultCommandHandlers: {
  [K in TailwindcssPatchCommand]: (
    context: TailwindcssPatchCommandContext<K>,
  ) => Promise<TailwindcssPatchCommandResultMap[K]>
} = {
  install: installCommandDefaultHandler,
  extract: extractCommandDefaultHandler,
  tokens: tokensCommandDefaultHandler,
  init: initCommandDefaultHandler,
  migrate: migrateCommandDefaultHandler,
  restore: restoreCommandDefaultHandler,
  validate: validateCommandDefaultHandler,
  status: statusCommandDefaultHandler,
}

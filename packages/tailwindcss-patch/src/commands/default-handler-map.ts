import type { TailwindcssPatchCommandDefaultHandlerMap } from './types'

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

export const defaultCommandHandlers = {
  install: installCommandDefaultHandler,
  extract: extractCommandDefaultHandler,
  tokens: tokensCommandDefaultHandler,
  init: initCommandDefaultHandler,
  migrate: migrateCommandDefaultHandler,
  restore: restoreCommandDefaultHandler,
  validate: validateCommandDefaultHandler,
  status: statusCommandDefaultHandler,
} satisfies TailwindcssPatchCommandDefaultHandlerMap

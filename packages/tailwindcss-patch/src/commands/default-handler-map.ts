import type { TailwindcssPatchCommandDefaultHandlerMap } from './types'

import {
  extractCommandDefaultHandler,
  initCommandDefaultHandler,
  installCommandDefaultHandler,
  tokensCommandDefaultHandler,
} from './basic-handlers'
import {
  migrateCommandDefaultHandler,
} from './migrate-handler'
import { restoreCommandDefaultHandler } from './restore-handler'
import { validateCommandDefaultHandler } from './validate-handler'
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

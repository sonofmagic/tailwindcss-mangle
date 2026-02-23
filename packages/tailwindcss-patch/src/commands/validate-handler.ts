import type { TailwindcssPatchCommandContext } from './types'

import { restoreConfigFiles } from './migrate-config'
import { resolveValidateCommandArgs } from './migration-args'
import {
  logValidateFailureAsJson,
  logValidateFailureSummary,
  logValidateSuccessAsJson,
  logValidateSuccessSummary,
} from './migration-output'
import { classifyValidateError, ValidateCommandError } from './validate'

export async function validateCommandDefaultHandler(ctx: TailwindcssPatchCommandContext<'validate'>) {
  const { args } = ctx
  const validateArgs = resolveValidateCommandArgs(args)
  try {
    const result = await restoreConfigFiles({
      cwd: ctx.cwd,
      reportFile: validateArgs.reportFile,
      dryRun: true,
      strict: validateArgs.strict,
    })

    if (args.json) {
      logValidateSuccessAsJson(result)
      return result
    }

    logValidateSuccessSummary(result)
    return result
  }
  catch (error) {
    const summary = classifyValidateError(error)
    if (args.json) {
      logValidateFailureAsJson(summary)
    }
    else {
      logValidateFailureSummary(summary)
    }
    throw new ValidateCommandError(summary, { cause: error })
  }
}

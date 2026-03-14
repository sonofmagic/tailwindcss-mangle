import { describe, expect, it } from 'vitest'
import { isMissingModuleError } from '../src/config/workspace'

function createNodeError(code: string, message: string) {
  const error = new Error(message) as NodeJS.ErrnoException
  error.code = code
  return error
}

describe('workspace module resolution guards', () => {
  it('treats ERR_MODULE_NOT_FOUND for workspace dist entries as fallback-worthy', () => {
    const error = createNodeError(
      'ERR_MODULE_NOT_FOUND',
      `Cannot find module '/repo/node_modules/@tailwindcss-mangle/shared/dist/index.js' imported from /repo/packages/tailwindcss-patch/src/config/workspace.ts`,
    )

    expect(isMissingModuleError(error, '@tailwindcss-mangle/shared')).toBe(true)
  })

  it('treats classic MODULE_NOT_FOUND package lookup errors as fallback-worthy', () => {
    const error = createNodeError(
      'MODULE_NOT_FOUND',
      `Cannot find module '@tailwindcss-mangle/config' imported from /repo/packages/tailwindcss-patch/src/config/workspace.ts`,
    )

    expect(isMissingModuleError(error, '@tailwindcss-mangle/config')).toBe(true)
  })

  it('ignores unrelated missing-module errors', () => {
    const error = createNodeError(
      'ERR_MODULE_NOT_FOUND',
      `Cannot find module '/repo/node_modules/other-package/dist/index.js' imported from /repo/packages/tailwindcss-patch/src/config/workspace.ts`,
    )

    expect(isMissingModuleError(error, '@tailwindcss-mangle/shared')).toBe(false)
  })
})

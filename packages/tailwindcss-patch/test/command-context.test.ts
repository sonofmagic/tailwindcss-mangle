import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import {
  createMemoizedPromiseRunner,
  resolveCommandCwd,
} from '../src/commands/command-context'

describe('command context helpers', () => {
  it('resolves cwd with process cwd fallback', () => {
    expect(resolveCommandCwd()).toBe(process.cwd())
    expect(resolveCommandCwd('tmp/runtime-cwd')).toBe(path.resolve('tmp/runtime-cwd'))
  })

  it('memoizes async factory calls', async () => {
    const factory = vi.fn(async () => ({ ok: true }))
    const run = createMemoizedPromiseRunner(factory)
    const resultA = await run()
    const resultB = await run()

    expect(factory).toHaveBeenCalledOnce()
    expect(resultA).toBe(resultB)
  })
})

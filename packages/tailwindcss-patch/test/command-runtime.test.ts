import { describe, expect, it, vi } from 'vitest'
import { runWithCommandHandler } from '../src/commands/command-runtime'

describe('command runtime', () => {
  it('uses default handler when custom handler is not provided', async () => {
    const cli = {} as any
    const command = {} as any
    const defaultHandler = vi.fn(async () => ({ ok: true }))

    const result = await runWithCommandHandler(
      cli,
      command,
      'status',
      { cwd: process.cwd(), json: true },
      undefined,
      defaultHandler as any,
    )

    expect(result).toEqual({ ok: true })
    expect(defaultHandler).toHaveBeenCalledOnce()
  })

  it('passes lazy next() into custom handler and memoizes default execution', async () => {
    const cli = {} as any
    const command = {} as any
    const defaultHandler = vi.fn(async () => ({ calls: 1 }))
    const customHandler = vi.fn(async (_ctx, next) => {
      const first = await next()
      const second = await next()
      return { first, second }
    })

    const result = await runWithCommandHandler(
      cli,
      command,
      'status',
      { cwd: process.cwd(), json: true },
      customHandler as any,
      defaultHandler as any,
    )

    expect(defaultHandler).toHaveBeenCalledOnce()
    expect(customHandler).toHaveBeenCalledOnce()
    expect(result).toEqual({
      first: { calls: 1 },
      second: { calls: 1 },
    })
  })
})

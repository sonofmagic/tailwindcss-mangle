import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runWithCommandHandler } from '../src/commands/command-runtime'

const {
  loadPatchOptionsForWorkspaceMock,
  loadWorkspaceConfigModuleMock,
  getConfigMock,
  tailwindcssPatcherCtorMock,
} = vi.hoisted(() => ({
  loadPatchOptionsForWorkspaceMock: vi.fn(async (_cwd: string, overrides?: Record<string, unknown>) => ({
    cwd: _cwd,
    marker: 'options',
    ...(overrides ?? {}),
  })),
  loadWorkspaceConfigModuleMock: vi.fn(),
  getConfigMock: vi.fn(async (cwd: string) => ({ cwd, ok: true })),
  tailwindcssPatcherCtorMock: vi.fn(function TailwindcssPatcherMock(this: any, options: any) {
    this.options = options
  }),
}))

vi.mock('../src/config/workspace', () => {
  return {
    loadPatchOptionsForWorkspace: loadPatchOptionsForWorkspaceMock,
    loadWorkspaceConfigModule: loadWorkspaceConfigModuleMock,
  }
})

vi.mock('../src/api/tailwindcss-patcher', () => {
  return {
    TailwindcssPatcher: tailwindcssPatcherCtorMock as any,
  }
})

describe('command runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadWorkspaceConfigModuleMock.mockResolvedValue({
      getConfig: getConfigMock,
    })
  })

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

  it('resolves cwd and supports override/non-override context loaders with caching', async () => {
    const cli = {} as any
    const command = {} as any
    const defaultHandler = vi.fn(async (ctx: any) => {
      expect(ctx.cwd).toBe(path.resolve('./tmp/runtime-cwd'))

      const configA = await ctx.loadConfig()
      const configB = await ctx.loadConfig()
      expect(configA).toEqual(configB)

      const optionsA = await ctx.loadPatchOptions()
      const optionsB = await ctx.loadPatchOptions()
      const optionsOverride = await ctx.loadPatchOptions({ override: true })
      expect(optionsA).toEqual(optionsB)
      expect(optionsOverride.override).toBe(true)

      const patcherA = await ctx.createPatcher()
      const patcherB = await ctx.createPatcher()
      const patcherOverride = await ctx.createPatcher({ force: true })
      expect(patcherA).toBe(patcherB)
      expect((patcherOverride as any).options.force).toBe(true)

      return {
        optionsA,
        optionsB,
      }
    })

    await runWithCommandHandler(
      cli,
      command,
      'status',
      { cwd: './tmp/runtime-cwd', json: true },
      undefined,
      defaultHandler as any,
    )

    expect(defaultHandler).toHaveBeenCalledOnce()
    expect(loadWorkspaceConfigModuleMock).toHaveBeenCalledOnce()
    expect(getConfigMock).toHaveBeenCalledOnce()
    expect(loadPatchOptionsForWorkspaceMock).toHaveBeenNthCalledWith(1, path.resolve('./tmp/runtime-cwd'))
    expect(loadPatchOptionsForWorkspaceMock).toHaveBeenNthCalledWith(2, path.resolve('./tmp/runtime-cwd'), { override: true })
    expect(loadPatchOptionsForWorkspaceMock).toHaveBeenNthCalledWith(3, path.resolve('./tmp/runtime-cwd'), { force: true })
    expect(loadPatchOptionsForWorkspaceMock).toHaveBeenCalledTimes(3)
    expect(tailwindcssPatcherCtorMock).toHaveBeenCalledTimes(2)
  })

  it('falls back to process.cwd when args.cwd is missing', async () => {
    const defaultHandler = vi.fn(async (ctx: any) => ctx.cwd)

    const cwd = await runWithCommandHandler(
      {} as any,
      {} as any,
      'status',
      { json: true } as any,
      undefined,
      defaultHandler as any,
    )

    expect(cwd).toBe(process.cwd())
  })
})

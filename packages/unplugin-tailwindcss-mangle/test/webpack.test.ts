import type { Mock } from 'vitest'
import { Context } from '@tailwindcss-mangle/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import factory from '@/core/factory'

const { mockCtx, mockCssHandler, mockHtmlHandler, mockJsHandler } = vi.hoisted(() => {
  return {
    mockCtx: {
      options: {
        sources: {},
      },
      initConfig: vi.fn(),
      replaceMap: new Map(),
      classGenerator: {
        generateClassName: vi.fn(),
      },
      addToUsedBy: vi.fn(),
      isPreserveClass: vi.fn(() => false),
      isPreserveFunction: vi.fn(() => false),
      addPreserveClass: vi.fn(),
      dump: vi.fn(),
    },
    mockCssHandler: vi.fn(async (source: string) => ({ code: `/*handled*/${source}` })),
    mockHtmlHandler: vi.fn(() => ({ code: '<html></html>' })),
    mockJsHandler: vi.fn(() => ({ code: 'export {}' })),
  }
})

vi.mock('@tailwindcss-mangle/core', () => {
  const Context = vi.fn(function MockContext() {
    return mockCtx
  })
  return {
    Context,
    cssHandler: mockCssHandler,
    htmlHandler: mockHtmlHandler,
    jsHandler: mockJsHandler,
  }
})

function getLatestCtx() {
  return (Context as unknown as Mock).mock.results.at(-1)?.value ?? mockCtx
}

vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>()
  return {
    ...actual,
    getGroupedEntries: vi.fn((entries: [string, any][]) => {
      const css = entries.filter(([name]) => name.endsWith('.css'))
      const js = entries.filter(([name]) => name.endsWith('.js'))
      const html = entries.filter(([name]) => name.endsWith('.html'))
      return { css, js, html }
    }),
  }
})

function createSyncHook<TArgs extends any[] = any[]>() {
  const taps: Array<(...args: TArgs) => any> = []
  return {
    tap(_name: string, fn: (...args: TArgs) => any) {
      taps.push(fn)
    },
    call(...args: TArgs) {
      taps.forEach(fn => fn(...args))
    },
  }
}

function createAsyncHook<TArgs extends any[] = any[]>() {
  const taps: Array<(...args: TArgs) => Promise<any>> = []
  return {
    tapPromise(_opts: any, fn: (...args: TArgs) => Promise<any>) {
      taps.push(fn)
    },
    async promise(...args: TArgs) {
      for (const fn of taps) {
        await fn(...args)
      }
    },
  }
}

function createFakeCompiler() {
  const compilationHook = createSyncHook<any[]>()
  const loaderHook = createSyncHook<any[]>()
  const processAssetsHook = createAsyncHook<any[]>()

  const updates: Array<[string, any]> = []

  const compiler = {
    webpack: {
      NormalModule: {
        getCompilationHooks: () => ({
          loader: loaderHook,
        }),
      },
      Compilation: {
        PROCESS_ASSETS_STAGE_SUMMARIZE: 0,
      },
      sources: {
        ConcatSource: class {
          code: string
          constructor(code: string) {
            this.code = code
          }

          toString() {
            return this.code
          }

          source() {
            return this.code
          }
        },
      },
    },
    hooks: {
      compilation: compilationHook,
    },
    triggerCompilation(initial: Record<string, any> = {}) {
      const compilation = {
        hooks: {
          processAssets: processAssetsHook,
        },
        updateAsset: vi.fn((...args) => {
          updates.push(args as unknown as [string, any])
        }),
        ...initial,
      }
      compilationHook.call(compilation)
      return { compilation, loaderHook, processAssetsHook, updates }
    },
  }

  return compiler
}

describe('webpack plugin integration (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCtx.replaceMap = new Map()
  })

  it('injects the webpack loader before postcss-loader', () => {
    const compiler = createFakeCompiler()
    const [, mainPlugin, postPlugin] = factory() as any[]
    mainPlugin.webpack?.(compiler as any)
    postPlugin.webpack?.(compiler as any)

    const { loaderHook } = compiler.triggerCompilation()
    const module = {
      loaders: [
        { loader: 'style-loader' },
        { loader: 'postcss-loader' },
      ],
    }

    loaderHook.call({}, module)

    expect(module.loaders).toHaveLength(3)
    const inserted = module.loaders[1]
    expect(String(inserted.loader)).toContain('loader.cjs')
    expect(inserted.options?.ctx).toBe(getLatestCtx())
  })

  it('skips injection when postcss-loader is missing', () => {
    const compiler = createFakeCompiler()
    const [, mainPlugin, postPlugin] = factory() as any[]
    mainPlugin.webpack?.(compiler as any)
    postPlugin.webpack?.(compiler as any)

    const { loaderHook } = compiler.triggerCompilation()
    const module = {
      loaders: [{ loader: 'css-loader' }],
    }

    loaderHook.call({}, module)

    expect(module.loaders).toHaveLength(1)
  })

  it('transforms css assets during processAssets', async () => {
    const compiler = createFakeCompiler()
    const [, mainPlugin, postPlugin] = factory() as any[]
    mainPlugin.webpack?.(compiler as any)
    postPlugin.webpack?.(compiler as any)

    const { compilation, processAssetsHook, updates } = compiler.triggerCompilation()
    const assets = {
      'style.css': {
        source: () => ({
          toString: () => 'body { color: red; }',
        }),
      },
      'index.js': {
        source: () => ({
          toString: () => 'console.log("noop")',
        }),
      },
    }

    await processAssetsHook.promise(assets)

    expect(mockCssHandler).toHaveBeenCalledTimes(1)
    expect(mockCssHandler).toHaveBeenCalledWith('body { color: red; }', {
      id: 'style.css',
      ctx: getLatestCtx(),
    })
    expect(compilation.updateAsset).toHaveBeenCalledTimes(1)
    expect(updates[0][0]).toBe('style.css')
    expect(String(updates[0][1])).toContain('/*handled*/body { color: red; }')
  })
})

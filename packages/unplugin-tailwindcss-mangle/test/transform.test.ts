import { beforeEach, describe, expect, it, vi } from 'vitest'
import factory from '@/core/factory'

const {
  mockCtx,
  mockCssHandler,
  mockHtmlHandler,
  mockJsHandler,
  mockVueHandler,
  mockSvelteHandler,
} = vi.hoisted(() => {
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
    mockCssHandler: vi.fn(async (source: string) => ({ code: `css:${source}` })),
    mockHtmlHandler: vi.fn((source: string) => ({ code: `html:${source}` })),
    mockJsHandler: vi.fn((source: string) => ({ code: `js:${source}` })),
    mockVueHandler: vi.fn(async (source: string) => ({ code: `vue:${source}` })),
    mockSvelteHandler: vi.fn(async (source: string) => ({ code: `svelte:${source}` })),
  }
})

vi.mock('@tailwindcss-mangle/core', () => {
  const Context = vi.fn(() => {
    return mockCtx
  })
  return {
    Context,
    cssHandler: mockCssHandler,
    htmlHandler: mockHtmlHandler,
    jsHandler: mockJsHandler,
    vueHandler: mockVueHandler,
    svelteHandler: mockSvelteHandler,
  }
})

async function createMainPlugin() {
  const [prePlugin, mainPlugin] = factory() as any[]
  await prePlugin.buildStart?.()
  return mainPlugin
}

describe('transform dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('respects inline include filters before buildStart', () => {
    const [, mainPlugin] = factory({
      sources: {
        include: [/\.[cm]?[jt]sx?(?:$|\?)/],
      },
    } as any) as any[]

    expect(mainPlugin.transformInclude('/src/main.ts')).toBe(true)
    expect(mainPlugin.transformInclude('/src/index.html')).toBe(false)
    expect(mainPlugin.transformInclude('/src/index.html?html-proxy&index=0.js')).toBe(false)
  })

  it('uses vue handler for full SFC files', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('<template><div class="bg-red-500"/></template>', '/src/App.vue')

    expect(mockVueHandler).toHaveBeenCalledTimes(1)
    expect(mockJsHandler).not.toHaveBeenCalled()
  })

  it('uses css handler for vue style sub-requests', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('.bg-red-500{color:red}', '/src/App.vue?vue&type=style&lang.css')

    expect(mockCssHandler).toHaveBeenCalledTimes(1)
    expect(mockVueHandler).not.toHaveBeenCalled()
  })

  it('uses js handler for vue script sub-requests', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('const cls = "bg-red-500"', '/src/App.vue?vue&type=script&lang.ts')

    expect(mockJsHandler).toHaveBeenCalledTimes(1)
    expect(mockVueHandler).not.toHaveBeenCalled()
  })

  it('uses html handler for raw vue template sub-requests', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('<div class="bg-red-500"/>', '/src/App.vue?vue&type=template&id=123')

    expect(mockHtmlHandler).toHaveBeenCalledTimes(1)
    expect(mockJsHandler).not.toHaveBeenCalled()
  })

  it('uses svelte handler for full svelte files', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('<div class="bg-red-500"/>', '/src/App.svelte')

    expect(mockSvelteHandler).toHaveBeenCalledTimes(1)
    expect(mockJsHandler).not.toHaveBeenCalled()
  })

  it('uses html handler for html files', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('<div class="bg-red-500"/>', '/src/index.html')

    expect(mockHtmlHandler).toHaveBeenCalledTimes(1)
    expect(mockJsHandler).not.toHaveBeenCalled()
  })

  it('skips html file transforms in webpack runtime', async () => {
    const mainPlugin = await createMainPlugin()
    const result = await mainPlugin.transform.call(
      {
        getNativeBuildContext: () => ({ framework: 'webpack' }),
      },
      '<div class="bg-red-500"/>',
      '/src/index.html',
    )

    expect(result).toBeNull()
    expect(mockHtmlHandler).not.toHaveBeenCalled()
  })

  it('falls back to js handler for included unknown text files', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('const cls = "bg-red-500"', '/src/page.astro')

    expect(mockJsHandler).toHaveBeenCalledTimes(1)
  })

  it('uses html handler for unknown markup-like files', async () => {
    const mainPlugin = await createMainPlugin()
    await mainPlugin.transform('<div class="bg-red-500"></div>', '/src/page.astro')

    expect(mockHtmlHandler).toHaveBeenCalledTimes(1)
    expect(mockJsHandler).not.toHaveBeenCalled()
  })
})

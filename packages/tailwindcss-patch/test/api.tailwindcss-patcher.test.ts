import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TailwindcssPatcher } from '@/api/tailwindcss-patcher'

const fixturesRoot = path.resolve(__dirname, 'fixtures/v4')
let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-'))
})

afterEach(async () => {
  await fs.remove(tempDir)
  vi.restoreAllMocks()
})

describe('TailwindcssPatcher', () => {
  it('collects classes for Tailwind CSS v4 projects', async () => {
    const outputFile = path.join(tempDir, 'classes.json')

    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        file: outputFile,
      },
      tailwind: {
        version: 4,
        v4: {
          base: fixturesRoot,
          cssEntries: [path.join(fixturesRoot, 'index.css')],
        },
      },
    })

    const result = await patcher.extract({ write: true })

    expect(result.classList.length).toBeGreaterThan(0)
    expect(await fs.pathExists(outputFile)).toBe(true)
  })

  it('resolves @config relative to the CSS entry directory even when base is set', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(__dirname, 'tmp-entry-base-'))
    try {
      const cssDir = path.join(workspaceRoot, 'src')
      await fs.ensureDir(cssDir)

      const configPath = path.join(workspaceRoot, 'tailwind.config.js')
      await fs.writeFile(
        configPath,
        [
          'module.exports = {',
          '  content: ["./src/**/*.{html,css}"],',
          '  theme: {},',
          '};',
        ].join('\n'),
        'utf8',
      )

      const cssEntry = path.join(cssDir, 'app.css')
      await fs.writeFile(
        cssEntry,
        ['@import "tailwindcss";', '@config "../tailwind.config.js";'].join('\n'),
        'utf8',
      )

      const usageFile = path.join(cssDir, 'page.html')
      await fs.writeFile(usageFile, '<div class="px-[48rpx]"></div>', 'utf8')

      const patcher = new TailwindcssPatcher({
        cwd: workspaceRoot,
        overwrite: false,
        cache: false,
        output: {
          enabled: false,
        },
        tailwind: {
          version: 4,
          v4: {
            base: workspaceRoot,
            cssEntries: [cssEntry],
          },
        },
      })

      const result = await patcher.extract({ write: false })
      expect(result.classSet?.has('px-[48rpx]')).toBe(true)
    }
    finally {
      await fs.remove(workspaceRoot)
    }
  })

  it('merges multiple @config directives in a single CSS entry', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(__dirname, 'tmp-multi-config-'))
    try {
      const cssDir = path.join(workspaceRoot, 'src')
      await fs.ensureDir(cssDir)

      const configA = path.join(workspaceRoot, 'tailwind.config.js')
      const configB = path.join(workspaceRoot, 'tailwind.extra.js')

      await fs.writeFile(
        configA,
        [
          'module.exports = {',
          '  content: ["./src/**/*.{html,css}"],',
          '  theme: {',
          '    extend: {',
          '      colors: { configa: "#111111" },',
          '    },',
          '  },',
          '};',
        ].join('\n'),
        'utf8',
      )

      await fs.writeFile(
        configB,
        [
          'module.exports = {',
          '  content: ["./src/**/*.{html,css}"],',
          '  theme: {',
          '    extend: {',
          '      colors: { configb: "#222222" },',
          '    },',
          '  },',
          '};',
        ].join('\n'),
        'utf8',
      )

      const cssEntry = path.join(cssDir, 'app.css')
      await fs.writeFile(
        cssEntry,
        [
          '@import "tailwindcss";',
          '@config "../tailwind.config.js";',
          '@config "../tailwind.extra.js";',
        ].join('\n'),
        'utf8',
      )

      const usageFile = path.join(cssDir, 'index.html')
      await fs.writeFile(usageFile, '<div class="bg-configa bg-configb"></div>', 'utf8')

      const patcher = new TailwindcssPatcher({
        cwd: workspaceRoot,
        overwrite: false,
        cache: false,
        output: {
          enabled: false,
        },
        tailwind: {
          version: 4,
          v4: {
            base: workspaceRoot,
            cssEntries: [cssEntry],
          },
        },
      })

      const result = await patcher.extract({ write: false })
      expect(result.classSet?.has('bg-configa')).toBe(true)
      expect(result.classSet?.has('bg-configb')).toBe(true)
    }
    finally {
      await fs.remove(workspaceRoot)
    }
  })

  it('falls back to workspace sources when cssEntries directory is empty', async () => {
    const workspaceRoot = await fs.mkdtemp(path.join(__dirname, 'tmp-workspace-'))
    try {
      const cssDir = path.join(workspaceRoot, 'src/style')
      const cssEntry = path.join(cssDir, 'main.css')
      const usageFile = path.join(workspaceRoot, 'src/pages/home.html')
      const configPath = path.join(workspaceRoot, 'tailwind.config.js')

      await fs.ensureDir(cssDir)
      await fs.ensureDir(path.dirname(usageFile))

      await fs.writeFile(
        configPath,
        [
          'module.exports = {',
          '  content: [],',
          '  theme: {},',
          '};',
        ].join('\n'),
        'utf8',
      )

      await fs.writeFile(
        cssEntry,
        [
          '@config "../../tailwind.config.js";',
          '@source not "../../dist/**/*";',
          '@import "tailwindcss";',
        ].join('\n'),
        'utf8',
      )

      await fs.writeFile(usageFile, '<div class="bg-[#00aa55]"></div>', 'utf8')

      const patcher = new TailwindcssPatcher({
        cwd: workspaceRoot,
        overwrite: false,
        cache: false,
        output: {
          enabled: false,
        },
        tailwind: {
          version: 4,
          cwd: workspaceRoot,
          v4: {
            base: cssDir,
            cssEntries: [cssEntry],
          },
        },
      })

      const result = await patcher.extract({ write: false })

      expect(result.classSet?.has('bg-[#00aa55]')).toBe(true)
    }
    finally {
      await fs.remove(workspaceRoot)
    }
  })

  it('collects classes synchronously from runtime contexts', () => {
    const cacheFile = path.join(tempDir, 'cache.json')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: {
        enabled: true,
        dir: tempDir,
        file: 'cache.json',
      },
    })

    const classCache = new Map<string, any>([
      ['foo', []],
      ['bar', []],
    ])
    vi.spyOn(patcher, 'getContexts').mockReturnValue([
      {
        classCache,
      } as any,
    ])

    const result = patcher.getClassSetSync()

    expect(result).toBeDefined()
    expect(result?.has('foo')).toBe(true)
    expect(result?.has('bar')).toBe(true)
    expect(fs.pathExistsSync(cacheFile)).toBe(true)
    const cacheContent = fs.readJSONSync(cacheFile)
    expect(cacheContent?.schemaVersion).toBe(2)
    const firstEntry = Object.values(cacheContent?.contexts ?? {})[0] as { values?: string[] } | undefined
    expect(firstEntry?.values).toEqual(expect.arrayContaining(['foo', 'bar']))
  })

  it('treats legacy cache schema as miss to avoid cross-context pollution', () => {
    const cacheFile = path.join(tempDir, 'cache.json')
    fs.writeJSONSync(cacheFile, ['cached-class'])

    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: {
        enabled: true,
        dir: tempDir,
        file: 'cache.json',
        strategy: 'overwrite',
      },
    })

    vi.spyOn(patcher, 'getContexts').mockReturnValue([
      {
        classCache: new Map<string, any>(),
      } as any,
    ])

    const result = patcher.getClassSetSync()

    expect(result).toBeDefined()
    expect(result?.size).toBe(0)
  })

  it('defers synchronous class access until runtime contexts are populated', async () => {
    const tooltipClass = 'text-[#123456]'
    const contexts: any[] = []

    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
    })

    vi.spyOn(patcher, 'getContexts').mockImplementation(() => contexts)
    vi.spyOn(patcher as any, 'runTailwindBuildIfNeeded').mockImplementation(async () => {
      contexts.push({
        classCache: new Map([[tooltipClass, []]]),
      })
    })

    expect(patcher.getClassSetSync()).toBeUndefined()

    const { classSet } = await patcher.extract({ write: false })
    expect(classSet?.has(tooltipClass)).toBe(true)

    const syncSet = patcher.getClassSetSync()
    expect(syncSet?.has(tooltipClass)).toBe(true)
  })
})

import { createRequire } from 'node:module'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TailwindcssPatcher } from '@/api/tailwindcss-patcher'
import * as extraction from '@/extraction/candidate-extractor'
import logger from '@/logger'
import * as patchRunner from '@/patching/patch-runner'
import * as patchStatus from '@/patching/status'
import * as contextRegistry from '@/runtime/context-registry'
import * as runtimeBuild from '@/runtime/process-tailwindcss'

const fixturesRoot = path.resolve(__dirname, 'fixtures/v4')
const require = createRequire(import.meta.url)
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

  it('supports streamlined constructor options (projectRoot/tailwindcss/apply/extract)', async () => {
    const outputFile = path.join(tempDir, 'classes-modern.json')

    const patcher = new TailwindcssPatcher({
      projectRoot: fixturesRoot,
      apply: {
        overwrite: false,
        exposeContext: { refProperty: 'runtimeContexts' },
      },
      cache: false,
      extract: {
        write: true,
        file: outputFile,
        format: 'json',
      },
      tailwindcss: {
        version: 4,
        v4: {
          base: fixturesRoot,
          cssEntries: [path.join(fixturesRoot, 'index.css')],
        },
      },
    })

    const result = await patcher.extract()
    expect(result.classList.length).toBeGreaterThan(0)
    expect(result.filename).toBe(outputFile)
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
      tailwind: {
        versionHint: 3,
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
      tailwind: {
        versionHint: 3,
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
      tailwind: {
        versionHint: 3,
      },
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

  it('throws when getClassSetSync is used in Tailwind CSS v4 mode', () => {
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      tailwind: {
        version: 4,
      },
    })

    expect(() => patcher.getClassSetSync()).toThrow('getClassSetSync is not supported for Tailwind CSS v4 projects.')
  })

  it('writes extracted classes using lines format', async () => {
    const outputFile = path.join(tempDir, 'classes.txt')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: true,
        file: outputFile,
        format: 'lines',
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
    const content = await fs.readFile(outputFile, 'utf8')
    const lines = content.trim().split('\n')

    expect(result.filename).toBe(outputFile)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines).toEqual(result.classList)
  })

  it('returns extraction result without writing when output file is empty', async () => {
    const writeFileSpy = vi.spyOn(fs, 'writeFile')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: true,
        file: '',
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

    expect(result.filename).toBeUndefined()
    expect(result.classList.length).toBeGreaterThan(0)
    expect(writeFileSpy).not.toHaveBeenCalled()
  })

  it('logs cache clear summary through the public clearCache API', async () => {
    const debugSpy = vi.spyOn(logger, 'debug')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
    })

    const result = await patcher.clearCache()

    expect(result.scope).toBe('current')
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('[cache] clear scope=current'))
  })

  it('delegates patch and status methods to runtime helpers', async () => {
    const patchSpy = vi.spyOn(patchRunner, 'applyTailwindPatches').mockResolvedValue('patched' as any)
    const statusSpy = vi.spyOn(patchStatus, 'getPatchStatusReport').mockResolvedValue('status' as any)
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
    })

    await expect(patcher.patch()).resolves.toBe('patched')
    await expect(patcher.getPatchStatus()).resolves.toBe('status')
    expect(patchSpy).toHaveBeenCalledTimes(1)
    expect(statusSpy).toHaveBeenCalledTimes(1)
  })

  it('skips repeated patch work when patch targets are unchanged', async () => {
    const patchSpy = vi.spyOn(patchRunner, 'applyTailwindPatches').mockReturnValue({ ok: true } as any)
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
    })

    await patcher.patch()
    await patcher.patch()

    expect(patchSpy).toHaveBeenCalledTimes(1)
  })

  it('re-runs patch when tracked patch targets change', async () => {
    const rootDir = await fs.mkdtemp(path.join(tempDir, 'patch-targets-'))
    try {
      const packageRoot = path.join(rootDir, 'node_modules', 'tailwindcss')
      await fs.ensureDir(path.dirname(packageRoot))
      await fs.copy(path.resolve(__dirname, 'fixtures/versions/3.3.1'), packageRoot)

      const patcher = new TailwindcssPatcher({
        cwd: rootDir,
        overwrite: false,
        cache: false,
        output: {
          enabled: false,
        },
        tailwind: {
          version: 3,
          resolve: {
            paths: [rootDir],
          },
        },
        features: {
          extendLengthUnits: {
            enabled: true,
            units: ['rpx'],
          },
        },
      })

      const patchSpy = vi.spyOn(patchRunner, 'applyTailwindPatches')

      await patcher.patch()
      await patcher.patch()

      const targetFile = path.join(packageRoot, 'lib/util/dataTypes.js')
      await new Promise(resolve => setTimeout(resolve, 5))
      await fs.appendFile(targetFile, '\n// touch\n', 'utf8')

      await patcher.patch()

      expect(patchSpy).toHaveBeenCalledTimes(2)
    }
    finally {
      await fs.remove(rootDir)
    }
  })

  it('delegates context loading with configured ref property', () => {
    const loadSpy = vi.spyOn(contextRegistry, 'loadRuntimeContexts').mockReturnValue([])
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
      features: {
        exposeContext: {
          refProperty: 'customContextRef',
        },
      },
    })

    const contexts = patcher.getContexts()

    expect(contexts).toEqual([])
    expect(loadSpy).toHaveBeenCalledWith(patcher.packageInfo, patcher.majorVersion, 'customContextRef')
  })

  it('uses per-version tailwind execution options when building v2/v3 projects', async () => {
    const runBuildSpy = vi.spyOn(runtimeBuild, 'runTailwindBuild').mockResolvedValue({ css: '', messages: [] } as any)

    const v2Patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
      tailwind: {
        version: 2,
        cwd: path.join(tempDir, 'base-v2-cwd'),
        config: path.join(tempDir, 'base-v2.config.js'),
        postcssPlugin: 'base-v2-plugin',
        v2: {
          cwd: path.join(tempDir, 'v2-cwd'),
          config: path.join(tempDir, 'v2.config.js'),
          postcssPlugin: 'v2-plugin',
        },
      },
    })
    await (v2Patcher as any).runTailwindBuildIfNeeded()

    expect(runBuildSpy).toHaveBeenLastCalledWith({
      cwd: path.join(tempDir, 'v2-cwd'),
      majorVersion: 2,
      config: path.join(tempDir, 'v2.config.js'),
      postcssPlugin: 'v2-plugin',
    })

    const v3Patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
      tailwind: {
        version: 3,
        cwd: path.join(tempDir, 'base-v3-cwd'),
        config: path.join(tempDir, 'base-v3.config.js'),
        postcssPlugin: 'base-v3-plugin',
        v3: {
          cwd: path.join(tempDir, 'v3-cwd'),
        },
      },
    })
    await (v3Patcher as any).runTailwindBuildIfNeeded()

    expect(runBuildSpy).toHaveBeenLastCalledWith({
      cwd: path.join(tempDir, 'v3-cwd'),
      majorVersion: 3,
      config: path.join(tempDir, 'base-v3.config.js'),
      postcssPlugin: 'base-v3-plugin',
    })

    const v4Patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
      tailwind: {
        version: 4,
      },
    })
    await (v4Patcher as any).runTailwindBuildIfNeeded()
    expect(runBuildSpy).toHaveBeenCalledTimes(2)
  })

  it('collects content tokens and grouping options with explicit and default arguments', async () => {
    const report = {
      entries: [],
      filesScanned: 1,
      sources: [],
      skippedFiles: [],
    }
    const extractSpy = vi.spyOn(extraction, 'extractProjectCandidatesWithPositions').mockResolvedValue(report)
    const grouped = { 'a.html': [] }
    const groupSpy = vi.spyOn(extraction, 'groupTokensByFile').mockReturnValue(grouped)

    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        enabled: false,
      },
      tailwind: {
        version: 4,
      },
    })

    const defaultReport = await patcher.collectContentTokens()
    expect(defaultReport).toBe(report)
    expect(extractSpy).toHaveBeenLastCalledWith({
      cwd: patcher.options.projectRoot,
      sources: patcher.options.tailwind.v4?.sources ?? [],
    })

    const explicitSources = [{ base: tempDir, pattern: '**/*', negated: false }]
    const groupedResult = await patcher.collectContentTokensByFile({
      cwd: tempDir,
      sources: explicitSources,
      key: 'absolute',
      stripAbsolutePaths: true,
    })

    expect(groupedResult).toBe(grouped)
    expect(extractSpy).toHaveBeenLastCalledWith({
      cwd: tempDir,
      sources: explicitSources,
    })
    expect(groupSpy).toHaveBeenLastCalledWith(report, {
      key: 'absolute',
      stripAbsolutePaths: true,
    })
  })

  it('does not rewrite cache when repeated getClassSetSync returns the same class set', async () => {
    const cacheFile = path.join(tempDir, 'cache.json')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: {
        enabled: true,
        dir: tempDir,
        file: 'cache.json',
      },
      tailwind: {
        versionHint: 3,
      },
    })

    vi.spyOn(patcher, 'getContexts').mockReturnValue([
      {
        classCache: new Map([
          ['foo', []],
          ['bar', []],
        ]),
      } as any,
    ])

    const first = patcher.getClassSetSync()
    expect(first?.has('foo')).toBe(true)
    const initialStat = await fs.stat(cacheFile)

    await new Promise(resolve => setTimeout(resolve, 5))
    const second = patcher.getClassSetSync()
    const nextStat = await fs.stat(cacheFile)

    expect(second?.has('bar')).toBe(true)
    expect(nextStat.mtimeMs).toBe(initialStat.mtimeMs)
  })

  it('does not cache an empty class set as a successful result', () => {
    const cacheFile = path.join(tempDir, 'cache.json')
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: {
        enabled: true,
        dir: tempDir,
        file: 'cache.json',
        strategy: 'overwrite',
      },
      tailwind: {
        versionHint: 3,
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
    expect(fs.pathExistsSync(cacheFile)).toBe(false)
  })

  it('recollects classes after clearCache removes the current context entry', async () => {
    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: {
        enabled: true,
        dir: tempDir,
        file: 'cache.json',
      },
      tailwind: {
        versionHint: 3,
      },
    })

    const getContextsSpy = vi.spyOn(patcher, 'getContexts')
    getContextsSpy.mockReturnValue([
      {
        classCache: new Map([['first-pass', []]]),
      } as any,
    ])

    const first = patcher.getClassSetSync()
    expect(first?.has('first-pass')).toBe(true)

    await patcher.clearCache()

    getContextsSpy.mockReturnValue([
      {
        classCache: new Map([['second-pass', []]]),
      } as any,
    ])

    const second = patcher.getClassSetSync()
    expect(second?.has('second-pass')).toBe(true)
    expect(second?.has('first-pass')).toBe(false)
  })

  it('drops removed v3 content classes after recreating the patcher', async () => {
    const projectRoot = await fs.mkdtemp(path.join(tempDir, 'v3-refresh-'))
    const tailwindRoot = path.dirname(require.resolve('tailwindcss-3/package.json'))
    const postcssPlugin = require.resolve('tailwindcss-3')
    const wxmlFile = path.join(projectRoot, 'src/index.wxml')
    const marker = 'text-red-500'

    try {
      await fs.ensureDir(path.join(projectRoot, 'src'))
      await fs.writeFile(
        path.join(projectRoot, 'tailwind.config.js'),
        [
          'const path = require(\'path\')',
          'module.exports = {',
          '  content: [path.resolve(__dirname, "./src/*.{js,wxml}")],',
          '  theme: { extend: {} },',
          '  plugins: [],',
          '  corePlugins: { preflight: false },',
          '}',
        ].join('\n'),
        'utf8',
      )
      const original = '<view class="font-bold">baseline</view>\n'
      await fs.writeFile(wxmlFile, original, 'utf8')

      const createPatcher = () => new TailwindcssPatcher({
        projectRoot,
        cache: false,
        output: {
          enabled: false,
        },
        tailwind: {
          packageName: 'tailwindcss-3',
          version: 3,
          resolve: {
            paths: [path.dirname(tailwindRoot)],
          },
          cwd: projectRoot,
          config: path.join(projectRoot, 'tailwind.config.js'),
          postcssPlugin,
          v3: {
            cwd: projectRoot,
            config: path.join(projectRoot, 'tailwind.config.js'),
            postcssPlugin,
          },
        },
      })

      const baselinePatcher = createPatcher()
      await baselinePatcher.patch()
      const baseline = await baselinePatcher.extract({ write: false })
      expect(baseline.classSet.has(marker)).toBe(false)

      await fs.writeFile(wxmlFile, `${original}<view class="${marker}">hmr</view>\n`, 'utf8')
      const updatedPatcher = createPatcher()
      await updatedPatcher.patch()
      const updated = await updatedPatcher.extract({ write: false })
      expect(updated.classSet.has(marker)).toBe(true)

      await fs.writeFile(wxmlFile, original, 'utf8')
      const restoredPatcher = createPatcher()
      await restoredPatcher.patch()
      const restored = await restoredPatcher.extract({ write: false })
      expect(restored.classSet.has(marker)).toBe(false)
    }
    finally {
      await fs.remove(projectRoot)
    }
  })
})

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
        packageName: 'tailwindcss-3',
        version: 3,
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

    expect(result.has('foo')).toBe(true)
    expect(result.has('bar')).toBe(true)
    expect(fs.pathExistsSync(cacheFile)).toBe(true)
    const cacheContent = fs.readJSONSync(cacheFile)
    expect(cacheContent).toEqual(expect.arrayContaining(['foo', 'bar']))
  })

  it('falls back to cached classes when runtime contexts are empty', () => {
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
        packageName: 'tailwindcss-3',
        version: 3,
      },
    })

    vi.spyOn(patcher, 'getContexts').mockReturnValue([
      {
        classCache: new Map<string, any>(),
      } as any,
    ])

    const result = patcher.getClassSetSync()

    expect(result.size).toBe(1)
    expect(result.has('cached-class')).toBe(true)
  })
})

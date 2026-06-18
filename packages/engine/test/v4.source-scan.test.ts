import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTailwindV4CompiledSourceEntries,
  createTailwindV4DefaultIgnoreSources,
  createTailwindV4SourceEntryMatcher,
  expandTailwindV4SourceEntries,
  isFileExcludedByTailwindV4SourceEntries,
  isFileMatchedByTailwindV4SourceEntries,
  normalizeTailwindV4ScannerSources,
  normalizeTailwindV4SourceEntries,
  resolveTailwindV4SourceEntry,
} from '@/v4'

const tempDirs: string[] = []

async function createTempDir(prefix: string) {
  const tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), prefix)))
  tempDirs.push(tempDir)
  return tempDir
}

async function writeTempFile(file: string, content = '') {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content, 'utf8')
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })))
})

describe('Tailwind v4 source scan helpers', () => {
  it('normalizes @source directory, glob, file, and not entries like Tailwind v4 public sources', async () => {
    const root = await createTempDir('tw-engine-v4-source-scan-')
    await fs.mkdir(path.join(root, 'src'), { recursive: true })
    await writeTempFile(path.join(root, 'templates/card.html'))

    await expect(Promise.all([
      resolveTailwindV4SourceEntry('./src', root, false),
      resolveTailwindV4SourceEntry('./src/**/*.{html,js}', root, false),
      resolveTailwindV4SourceEntry('./templates/card.html', root, false),
      resolveTailwindV4SourceEntry('./src/legacy', root, true),
    ])).resolves.toEqual([
      { base: path.join(root, 'src'), pattern: '**/*', negated: false },
      { base: path.join(root, 'src'), pattern: '**/*.{html,js}', negated: false },
      { base: root, pattern: 'templates/card.html', negated: false },
      { base: root, pattern: 'src/legacy', negated: true },
    ])
  })

  it('merges source(none), source roots, and @source entries from compiled CSS metadata', () => {
    const root = '/project'

    expect(createTailwindV4CompiledSourceEntries('none', [{ base: root, pattern: './admin', negated: false }], root))
      .toEqual([{ base: root, pattern: './admin', negated: false }])

    expect(createTailwindV4CompiledSourceEntries(null, [], root))
      .toEqual([{ base: root, pattern: '**/*', negated: false }])

    expect(createTailwindV4CompiledSourceEntries(
      { base: root, pattern: './src' },
      [{ base: root, pattern: './legacy', negated: true }],
      root,
    )).toEqual([
      { base: root, pattern: './src', negated: false },
      { base: root, pattern: './legacy', negated: true },
    ])
  })

  it('expands brace source patterns before they are passed to the oxide scanner', () => {
    const root = '/project'

    expect(normalizeTailwindV4ScannerSources([
      { base: root, pattern: 'src/**/*.{html,tsx}', negated: false },
    ], root)).toEqual([
      { base: root, pattern: 'src/**/*.html', negated: false },
      { base: root, pattern: 'src/**/*.tsx', negated: false },
    ])
  })

  it('matches files with positive sources and excludes negative entries', async () => {
    const root = await createTempDir('tw-engine-v4-source-match-')
    const srcFile = path.join(root, 'src/page.html')
    const ignoredFile = path.join(root, 'src/legacy/page.html')
    const outsideFile = path.join(root, 'outside/page.html')
    await writeTempFile(srcFile)
    await writeTempFile(ignoredFile)
    await writeTempFile(outsideFile)

    const entries = await normalizeTailwindV4SourceEntries([
      { base: root, pattern: './src', negated: false },
      { base: root, pattern: './src/legacy', negated: true },
    ], { cwd: root })
    const matcher = createTailwindV4SourceEntryMatcher(entries)

    expect(matcher?.(srcFile)).toBe(true)
    expect(matcher?.(ignoredFile)).toBe(false)
    expect(matcher?.(outsideFile)).toBe(false)
    expect(isFileMatchedByTailwindV4SourceEntries(srcFile, entries)).toBe(true)
    expect(isFileExcludedByTailwindV4SourceEntries(ignoredFile, entries)).toBe(true)
  })

  it('keeps explicit @source paths capable of entering otherwise ignored content directories', async () => {
    const root = await createTempDir('tw-engine-v4-source-external-')
    const sourceFile = path.join(root, 'node_modules/design-system/button.html')
    await writeTempFile(sourceFile, '<button class="text-green-500"></button>')

    const files = await expandTailwindV4SourceEntries([
      { base: path.join(root, 'node_modules/design-system'), pattern: '**/*', negated: false },
    ], async ({ sources }) => {
      expect(sources).toEqual([
        { base: path.join(root, 'node_modules/design-system'), pattern: '**/*', negated: false },
      ])
      return [sourceFile]
    })

    expect(files).toEqual([sourceFile])
  })

  it('exposes official Tailwind v4 default ignored directory, extension, and file rules', () => {
    const root = '/project'
    const ignoredSources = createTailwindV4DefaultIgnoreSources(root)

    expect(ignoredSources).toEqual(expect.arrayContaining([
      { base: root, pattern: '**/node_modules/**', negated: true },
      { base: root, pattern: '**/.git/**', negated: true },
      { base: root, pattern: '**/*.scss', negated: true },
      { base: root, pattern: '**/package-lock.json', negated: true },
      { base: root, pattern: '**/.env.*', negated: true },
    ]))
  })
})

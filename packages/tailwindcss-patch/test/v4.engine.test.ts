import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createTailwindV4Engine,
  resolveTailwindV4Source,
} from '@/v4'

const require = createRequire(import.meta.url)
const packageRoot = path.resolve(__dirname, '..')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))
const tempDirs: string[] = []

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-v4-engine-'))
  tempDirs.push(tempDir)
  return tempDir
}

async function createDefaultSource(css = '@import "tailwindcss";') {
  return resolveTailwindV4Source({
    projectRoot: packageRoot,
    base: tailwindNodeBase,
    css,
  })
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })))
})

describe('Tailwind v4 engine', () => {
  it('generates CSS from inline css and explicit candidates', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource())
    const result = await engine.generate({
      candidates: ['text-red-500'],
    })

    expect(result.classSet).toContain('text-red-500')
    expect(result.css).toContain('.text-red-500')
  })

  it('does not include invalid candidates in classSet', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource())
    const result = await engine.generate({
      candidates: ['text-red-500', 'definitely-not-a-tailwind-class'],
    })

    expect(result.classSet).toContain('text-red-500')
    expect(result.classSet).not.toContain('definitely-not-a-tailwind-class')
    expect(result.css).not.toContain('definitely-not-a-tailwind-class')
  })

  it('generates arbitrary value utilities', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource())
    const result = await engine.generate({
      candidates: ['w-[100px]'],
    })

    expect(result.classSet).toContain('w-[100px]')
    expect(result.css).toContain('width: 100px')
  })

  it('includes @source inline candidates in classSet', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource([
      '@import "tailwindcss";',
      '@source inline("w-4");',
    ].join('\n')))
    const result = await engine.generate()

    expect(result.rawCandidates).toContain('w-4')
    expect(result.classSet).toContain('w-4')
    expect(result.css).toContain('.w-4')
  })

  it('reads available cssEntries and records dependencies', async () => {
    const tempDir = await createTempDir()
    const entry = path.join(tempDir, 'app.css')
    await fs.writeFile(entry, '@source inline("w-4");', 'utf8')

    const source = await resolveTailwindV4Source({
      projectRoot: packageRoot,
      base: tailwindNodeBase,
      cssEntries: [entry],
    })

    expect(source.css).toContain('@source inline("w-4");')
    expect(source.dependencies).toContain(entry)
  })

  it('keeps missing cssEntries as imports and records dependencies', async () => {
    const tempDir = await createTempDir()
    const entry = path.join(tempDir, 'missing.css')

    const source = await resolveTailwindV4Source({
      projectRoot: packageRoot,
      base: tailwindNodeBase,
      cssEntries: [entry],
    })

    expect(source.css).toContain('@import "')
    expect(source.css).toContain('missing.css')
    expect(source.css).not.toContain('\\')
    expect(source.dependencies).toContain(entry)
  })

  it('falls back to tailwindcss when packageName is a PostCSS plugin', async () => {
    const source = await resolveTailwindV4Source({
      projectRoot: packageRoot,
      base: tailwindNodeBase,
      packageName: '@tailwindcss/postcss',
    })
    const engine = createTailwindV4Engine(source)
    const result = await engine.generate({
      candidates: ['w-4'],
    })

    expect(source.css).toBe('@import "tailwindcss";')
    expect(result.classSet).toContain('w-4')
    expect(result.css).toContain('.w-4')
  })

  it('uses the same validity check in validateCandidates and generate', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource())
    const candidates = ['w-4', 'w-[100px]', 'definitely-not-a-tailwind-class']
    const validated = await engine.validateCandidates(candidates)
    const generated = await engine.generate({ candidates })

    expect(generated.classSet).toEqual(validated)
  })

  it('scans candidate sources with the raw candidate scanner', async () => {
    const engine = createTailwindV4Engine(await createDefaultSource())
    const result = await engine.generate({
      sources: [
        {
          content: '<div class="text-blue-500 invalid-token"></div>',
          extension: 'html',
        },
      ],
    })

    expect(result.rawCandidates).toContain('text-blue-500')
    expect(result.classSet).toContain('text-blue-500')
    expect(result.classSet).not.toContain('invalid-token')
  })

  it('scans explicit filesystem sources when requested', async () => {
    const tempDir = await createTempDir()
    await fs.writeFile(
      path.join(tempDir, 'index.html'),
      '<div class="text-green-500 invalid-token"></div>',
      'utf8',
    )
    const engine = createTailwindV4Engine(await createDefaultSource())
    const result = await engine.generate({
      scanSources: [
        {
          base: tempDir,
          pattern: '**/*.html',
          negated: false,
        },
      ],
    })

    expect(result.rawCandidates).toContain('text-green-500')
    expect(result.classSet).toContain('text-green-500')
    expect(result.classSet).not.toContain('invalid-token')
    expect(result.css).toContain('.text-green-500')
  })

  it('uses compiled @source entries when scanSources is true', async () => {
    const tempDir = await createTempDir()
    const srcDir = path.join(tempDir, 'src')
    await fs.mkdir(srcDir, { recursive: true })
    await fs.writeFile(path.join(srcDir, 'index.html'), '<div class="text-green-500"></div>', 'utf8')
    await fs.writeFile(path.join(srcDir, 'ignored.html'), '<div class="text-red-500"></div>', 'utf8')
    const css = [
      '@import "tailwindcss";',
      '@source "./src/**/*.html";',
      '@source not "./src/ignored.html";',
    ].join('\n')
    const source = await resolveTailwindV4Source({
      projectRoot: tempDir,
      base: tempDir,
      baseFallbacks: [tailwindNodeBase],
      css,
    })
    const engine = createTailwindV4Engine(source)

    const withoutScan = await engine.generate()
    const withScan = await engine.generate({ scanSources: true })

    expect(withoutScan.classSet).not.toContain('text-green-500')
    expect(withScan.classSet).toContain('text-green-500')
    expect(withScan.classSet).not.toContain('text-red-500')
    expect(withScan.css).toContain('.text-green-500')
    expect(withScan.css).not.toContain('.text-red-500')
  })
})

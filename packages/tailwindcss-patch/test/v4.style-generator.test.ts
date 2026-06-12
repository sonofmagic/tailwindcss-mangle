import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { collectTailwindV4StyleCandidates, generateTailwindV4Style } from '@/v4'

const require = createRequire(import.meta.url)
const packageRoot = path.resolve(__dirname, '..')
const tailwindNodeBase = path.dirname(require.resolve('@tailwindcss/node'))
const tempDirs: string[] = []

async function createTempDir() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-v4-style-generator-'))
  tempDirs.push(tempDir)
  return tempDir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })))
})

describe('Tailwind v4 style generator', () => {
  it('collects candidates from inline content sources and explicit candidates', async () => {
    const candidates = await collectTailwindV4StyleCandidates({
      bareArbitraryValues: true,
      candidates: ['text-red-500'],
      sources: [
        {
          content: '<view class="min-h-screen rounded-[18px]"></view>',
          extension: 'tsx',
        },
        {
          content: '.primary { @apply inline-flex items-center; }',
          extension: 'css',
        },
      ],
    })

    expect(candidates).toEqual(new Set([
      'text-red-500',
      'min-h-screen',
      'rounded-[18px]',
      'inline-flex',
      'items-center',
    ]))
  })

  it('generates css from collected candidates using tailwindcss-patch engine', async () => {
    const result = await generateTailwindV4Style({
      projectRoot: packageRoot,
      cwd: packageRoot,
      base: tailwindNodeBase,
      css: '@import "tailwindcss";',
      bareArbitraryValues: true,
      candidates: ['text-red-500'],
      sources: [
        {
          content: '<view class="min-h-screen rounded-[18px]"></view>',
          extension: 'tsx',
        },
        {
          content: '.primary { @apply inline-flex items-center; }',
          extension: 'css',
        },
      ],
    })

    expect(result.tokens).toEqual(new Set([
      'text-red-500',
      'min-h-screen',
      'rounded-[18px]',
      'inline-flex',
      'items-center',
    ]))
    expect(result.classSet).toContain('min-h-screen')
    expect(result.classSet).toContain('rounded-[18px]')
    expect(result.classSet).toContain('inline-flex')
    expect(result.css).toContain('.min-h-screen')
    expect(result.css).toContain('.rounded-\\[18px\\]')
    expect(result.css).toContain('.inline-flex')
    expect(result.source.css).toBe('@import "tailwindcss";')
  })

  it('can write generated assets through a custom consumer', async () => {
    const outputDir = await createTempDir()
    const result = await generateTailwindV4Style({
      projectRoot: packageRoot,
      cwd: packageRoot,
      base: tailwindNodeBase,
      css: '@import "tailwindcss";',
      candidates: ['bg-slate-950'],
    })

    await fs.writeFile(path.join(outputDir, 'style.css'), result.css)
    await fs.writeFile(path.join(outputDir, 'tokens.json'), JSON.stringify({
      tokens: [...result.tokens],
      classSet: [...result.classSet],
    }))

    await expect(fs.readFile(path.join(outputDir, 'style.css'), 'utf8')).resolves.toContain('.bg-slate-950')
    await expect(fs.readFile(path.join(outputDir, 'tokens.json'), 'utf8')).resolves.toContain('bg-slate-950')
  })
})

import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { normalizeOptions } from '@/options/normalize'
import { collectClassesFromContexts, collectClassesFromTailwindV4 } from '@/runtime/class-collector'

function createContext(classes: string[]) {
  const map = new Map()
  for (const cls of classes) {
    map.set(cls, [])
  }
  return {
    classCache: map,
  } as any
}

function createContextWithCandidateRuleCache(rawCandidates: string[], normalizedClasses: string[]) {
  const candidateRuleCache = new Map()
  for (const candidate of rawCandidates) {
    candidateRuleCache.set(candidate, new Set())
  }

  const classCache = new Map()
  for (const cls of normalizedClasses) {
    classCache.set(cls, [])
  }

  return {
    candidateRuleCache,
    classCache,
  } as any
}

describe('collectClassesFromContexts', () => {
  it('aggregates class names respecting the filter', () => {
    const contexts = [createContext(['text-lg', '*', 'font-bold'])]
    const filter = (className: string) => className !== '*'
    const result = collectClassesFromContexts(contexts as any, filter)
    expect(result.has('text-lg')).toBe(true)
    expect(result.has('*')).toBe(false)
  })

  it.each([
    {
      name: 'keeps shorthand hex tokens when shorthand is the only source token',
      rawCandidates: ['bg-[#000]'],
      normalizedClasses: ['bg-[#000000]'],
      expectedPresent: ['bg-[#000]'],
      expectedAbsent: ['bg-[#000000]'],
    },
    {
      name: 'keeps full hex tokens when full hex is the only source token',
      rawCandidates: ['bg-[#000000]'],
      normalizedClasses: ['bg-[#000000]'],
      expectedPresent: ['bg-[#000000]'],
      expectedAbsent: ['bg-[#000]'],
    },
    {
      name: 'keeps shorthand and full hex tokens distinct when both appear',
      rawCandidates: ['bg-[#000]', 'bg-[#000000]'],
      normalizedClasses: ['bg-[#000000]'],
      expectedPresent: ['bg-[#000]', 'bg-[#000000]'],
      expectedAbsent: [],
    },
    {
      name: 'does not merge red shorthand and full hex tokens',
      rawCandidates: ['bg-[#f00]', 'bg-[#ff0000]'],
      normalizedClasses: ['bg-[#ff0000]'],
      expectedPresent: ['bg-[#f00]', 'bg-[#ff0000]'],
      expectedAbsent: [],
    },
    {
      name: 'does not merge green shorthand and full hex tokens',
      rawCandidates: ['bg-[#0f0]', 'bg-[#00ff00]'],
      normalizedClasses: ['bg-[#00ff00]'],
      expectedPresent: ['bg-[#0f0]', 'bg-[#00ff00]'],
      expectedAbsent: [],
    },
  ])('$name', ({ rawCandidates, normalizedClasses, expectedPresent, expectedAbsent }) => {
    const contexts = [createContextWithCandidateRuleCache(rawCandidates, normalizedClasses)]
    const result = collectClassesFromContexts(contexts as any, () => true)

    for (const token of expectedPresent) {
      expect(result.has(token)).toBe(true)
    }

    for (const token of expectedAbsent) {
      expect(result.has(token)).toBe(false)
    }
  })
})

describe('collectClassesFromTailwindV4', () => {
  it('resolves @config relative to the CSS entry directory', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-v4-class-collector-'))
    try {
      const cssDir = path.join(tempDir, 'src')
      await fs.ensureDir(cssDir)

      const configPath = path.join(tempDir, 'tailwind.config.js')
      await fs.writeFile(
        configPath,
        [
          'module.exports = {',
          '  content: [],',
          '  theme: {',
          '    extend: {',
          '      colors: {',
          '        brand: \'#534312\',',
          '      },',
          '    },',
          '  },',
          '};',
        ].join('\n'),
        'utf8',
      )

      const cssPath = path.join(cssDir, 'app.css')
      await fs.writeFile(
        cssPath,
        [
          '@config "../tailwind.config.js";',
          '@utility bg-brand {',
          '  background-color: #534312;',
          '}',
        ].join('\n'),
        'utf8',
      )

      const usageFile = path.join(cssDir, 'index.html')
      await fs.writeFile(usageFile, '<div class="bg-brand"></div>', 'utf8')

      const normalized = normalizeOptions({
        projectRoot: tempDir,
        tailwindcss: {
          version: 4,
          v4: {
            cssEntries: [cssPath],
          },
        },
      })

      const classes = await collectClassesFromTailwindV4(normalized)
      expect(classes.has('bg-brand')).toBe(true)
    }
    finally {
      await fs.remove(tempDir)
    }
  })
})

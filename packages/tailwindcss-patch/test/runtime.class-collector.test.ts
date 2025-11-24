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

describe('collectClassesFromContexts', () => {
  it('aggregates class names respecting the filter', () => {
    const contexts = [createContext(['text-lg', '*', 'font-bold'])]
    const filter = (className: string) => className !== '*'
    const result = collectClassesFromContexts(contexts as any, filter)
    expect(result.has('text-lg')).toBe(true)
    expect(result.has('*')).toBe(false)
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
        cwd: tempDir,
        tailwind: {
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

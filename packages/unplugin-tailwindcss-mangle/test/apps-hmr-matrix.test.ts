import fs from 'node:fs/promises'
import path from 'pathe'
import { appCases, hmrCases } from '../../../e2e/apps.hmr.shared'

const viteHmrAppNames = [
  'solid-app',
  'vite-lit',
  'vite-react',
  'vite-svelte',
  'vite-vanilla',
  'vite-vue',
]

describe('apps hmr e2e matrix', () => {
  it('covers every Vite-based app that uses the unplugin integration', () => {
    expect(hmrCases.map(app => app.name).sort()).toEqual(viteHmrAppNames)
  })

  it('only covers apps that use tailwindcss-patch and unplugin-tailwindcss-mangle', () => {
    for (const hmrCase of hmrCases) {
      const appCase = appCases.find(app => app.name === hmrCase.name)
      expect(appCase?.usesTailwindcssPatch).toBe(true)
      expect(appCase?.usesUnpluginTailwindcssMangle).toBe(true)
    }
  })

  it('uses distinct source classes for HMR updates', () => {
    for (const hmrCase of hmrCases) {
      expect(hmrCase.beforeClass).not.toBe(hmrCase.afterClass)
      expect(hmrCase.sourceFile.length).toBeGreaterThan(0)
    }
  })

  it('adds Tailwind classes that are absent before the HMR mutation', async () => {
    for (const hmrCase of hmrCases) {
      const source = await fs.readFile(path.resolve(hmrCase.appDir, hmrCase.sourceFile), 'utf8')

      expect(source).toContain(hmrCase.beforeClass)
      expect(source).not.toContain(hmrCase.afterClass)
    }
  })
})

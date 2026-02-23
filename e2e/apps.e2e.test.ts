import fs from 'node:fs/promises'
import path from 'pathe'
import { buildApp, cases, ensureClassList, readMappingFile, resolveMapFile, resolveOutputRoots, resolveUsageRoots } from './apps.e2e.shared'

const runAppsE2E = process.env.TWM_APPS_E2E === '1'

const usageExt = new Set([
  '.html',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.txt',
])

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasClassUsage(content: string, className: string) {
  const escaped = escapeRegExp(className)
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=[^A-Za-z0-9_-]|$)`).test(content)
}

function hasCssSelector(css: string, className: string) {
  const escaped = escapeRegExp(className)
  return new RegExp(`\\.${escaped}(?=[^A-Za-z0-9_-]|$)`).test(css)
}

function extractInlineStyles(html: string) {
  let css = ''
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let match = styleRegex.exec(html)
  while (match !== null) {
    css += `\n${match[1]}`
    match = styleRegex.exec(html)
  }
  return css
}

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.resolve(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath))
      continue
    }
    files.push(fullPath)
  }
  return files
}

async function collectUsageText(usageRoots: string[]) {
  let usageText = ''

  for (const root of usageRoots) {
    const files = await listFilesRecursive(root)
    for (const file of files) {
      if (file.endsWith('.map')) {
        continue
      }
      const ext = path.extname(file)
      if (!usageExt.has(ext)) {
        continue
      }
      usageText += `\n${await fs.readFile(file, 'utf8')}`
    }
  }

  return usageText
}

async function collectCssText(outputRoots: string[]) {
  let cssText = ''

  for (const root of outputRoots) {
    const files = await listFilesRecursive(root)
    for (const file of files) {
      if (file.endsWith('.map')) {
        continue
      }
      if (file.endsWith('.css')) {
        cssText += `\n${await fs.readFile(file, 'utf8')}`
        continue
      }
      if (file.endsWith('.html')) {
        const html = await fs.readFile(file, 'utf8')
        cssText += extractInlineStyles(html)
      }
    }
  }

  return cssText
}

describe.runIf(runAppsE2E)('apps integration e2e', () => {
  for (const app of cases) {
    it(`builds ${app.name} and validates mangled css coverage`, async () => {
      const mapFile = resolveMapFile(app.appDir)

      await ensureClassList(app)
      await fs.rm(mapFile, { force: true })

      await buildApp(app)

      const mappings = await readMappingFile(app.appDir)
      expect(mappings.length).toBeGreaterThan(0)

      const expected = mappings.find(item => item.original === app.expectedOriginalClass)
      expect(expected).toBeDefined()
      expect(expected?.mangled.startsWith('tw-')).toBe(true)
      expect(Array.isArray(expected?.usedBy)).toBe(true)

      const outputRoots = await resolveOutputRoots(app)
      expect(outputRoots.length).toBeGreaterThan(0)
      const usageRoots = await resolveUsageRoots(app)
      expect(usageRoots.length).toBeGreaterThan(0)

      const usageText = await collectUsageText(usageRoots)
      const cssText = await collectCssText(outputRoots)
      const usedMappings = mappings.filter(item => hasClassUsage(usageText, item.mangled))
      const mappingsForCoverage = usedMappings.length > 0 ? usedMappings : mappings
      expect(mappingsForCoverage.length).toBeGreaterThan(0)

      const missing = mappingsForCoverage.filter(item => !hasCssSelector(cssText, item.mangled))
      expect(
        missing,
        `Missing css selectors for ${app.name}: ${missing
          .slice(0, 15)
          .map(item => `${item.original}->${item.mangled}`)
          .join(', ')}`,
      ).toEqual([])
    }, 300_000)
  }
})

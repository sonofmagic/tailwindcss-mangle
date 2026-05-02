import fs from 'node:fs/promises'
import path from 'pathe'
import { cases, extractInlineStyles, hasClassUsage, hasCssSelector, repoRoot } from '../../../e2e/apps.e2e.shared'

interface PackageJson {
  name: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

async function readJson<T>(file: string) {
  return JSON.parse(await fs.readFile(file, 'utf8')) as T
}

async function listAppPackageJsonFiles() {
  const appsDir = path.resolve(repoRoot, 'apps')
  const entries = await fs.readdir(appsDir, { withFileTypes: true })
  const packageJsonFiles = entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.resolve(appsDir, entry.name, 'package.json'))
    .sort()
  const existingFiles: string[] = []

  for (const file of packageJsonFiles) {
    try {
      await fs.access(file)
      existingFiles.push(file)
    }
    catch {
      // ignore app fixtures without package metadata
    }
  }

  return existingFiles
}

function getDependencyNames(pkg: PackageJson) {
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
}

describe('apps e2e matrix', () => {
  it('covers every app that declares tailwindcss-patch or unplugin-tailwindcss-mangle', async () => {
    const appPackageJsonFiles = await listAppPackageJsonFiles()
    const appNamesWithMangleDeps: string[] = []
    const appNamesWithUnplugin: string[] = []

    for (const file of appPackageJsonFiles) {
      const pkg = await readJson<PackageJson>(file)
      const deps = getDependencyNames(pkg)
      if (deps.has('tailwindcss-patch') || deps.has('unplugin-tailwindcss-mangle')) {
        appNamesWithMangleDeps.push(path.basename(path.dirname(file)))
      }
      if (deps.has('unplugin-tailwindcss-mangle')) {
        appNamesWithUnplugin.push(path.basename(path.dirname(file)))
      }
    }

    expect(cases.map(app => app.name).sort()).toEqual(appNamesWithMangleDeps.sort())
    expect(cases.filter(app => app.usesUnpluginTailwindcssMangle).map(app => app.name).sort()).toEqual(appNamesWithUnplugin.sort())
  })

  it('marks all unplugin apps as expecting mangled output', () => {
    const unpluginCases = cases.filter(app => app.usesUnpluginTailwindcssMangle)

    expect(unpluginCases.length).toBeGreaterThan(0)
    expect(unpluginCases.every(app => app.expectMangledOutput)).toBe(true)
    expect(cases.filter(app => !app.usesUnpluginTailwindcssMangle).map(app => app.name)).toEqual(['remix-app'])
  })

  it('matches class usages and css selectors without substring false positives', () => {
    expect(hasClassUsage('class="tw-a tw-b"', 'tw-a')).toBe(true)
    expect(hasClassUsage('class="tw-ab"', 'tw-a')).toBe(false)
    expect(hasCssSelector('.tw-a:hover{color:red}.tw-ab{color:blue}', 'tw-a')).toBe(true)
    expect(hasCssSelector('.tw-ab{color:blue}', 'tw-a')).toBe(false)
  })

  it('extracts inline styles from html output', () => {
    const html = '<style>.tw-a{color:red}</style><main></main><style data-vite-dev-id="x">.tw-b{color:blue}</style>'

    expect(extractInlineStyles(html)).toContain('.tw-a{color:red}')
    expect(extractInlineStyles(html)).toContain('.tw-b{color:blue}')
  })
})

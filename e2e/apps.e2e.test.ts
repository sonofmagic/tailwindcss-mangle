import fs from 'node:fs/promises'
import {
  buildApp,
  cases,
  collectCssText,
  collectUsageText,
  ensureClassList,
  hasClassUsage,
  hasCssSelector,
  readClassListFile,
  readMappingFile,
  resolveClassListFile,
  resolveMapFile,
  resolveOutputRoots,
  resolveUsageRoots,
  runTailwindcssPatch,
} from './apps.e2e.shared'

const runAppsE2E = process.env.TWM_APPS_E2E === '1'

describe.runIf(runAppsE2E)('apps integration e2e', () => {
  for (const app of cases) {
    it(`builds ${app.name} and validates tailwindcss-patch/unplugin output`, async () => {
      const classListFile = resolveClassListFile(app.appDir)
      const mapFile = resolveMapFile(app.appDir)

      await fs.rm(classListFile, { force: true })
      await fs.rm(mapFile, { force: true })
      await ensureClassList(app)
      if (app.usesTailwindcssPatch) {
        await runTailwindcssPatch(app)
      }

      await buildApp(app)

      if (app.usesTailwindcssPatch) {
        const classList = await readClassListFile(app.appDir)
        expect(classList.length).toBeGreaterThan(0)
        expect(classList).toContain(app.expectedOriginalClass)
      }

      if (!app.expectMangledOutput) {
        return
      }

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

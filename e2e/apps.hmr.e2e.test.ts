import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'
import path from 'pathe'
import {
  hasDevCssSelector,
  hmrCases,
  seedHmrPatch,
  snapshotDomClasses,
  startViteDevServer,
  stopRunningCommand,
} from './apps.hmr.shared'
import { snapshotFiles } from './files'
import { resolveChromiumLaunchOptions } from './playwright.shared'

const runHmrE2E = process.env['TWM_APPS_E2E_HMR'] === '1'
const basePort = 4400

describe.runIf(runHmrE2E)('apps hmr e2e', () => {
  for (const [index, app] of hmrCases.entries()) {
    it(`hot updates Tailwind classes in ${app.name}`, async () => {
      const sourceFile = path.resolve(app.appDir, app.sourceFile)
      const classListFile = path.resolve(app.appDir, '.tw-patch/tw-class-list.json')
      const mapFile = path.resolve(app.appDir, '.tw-patch/tw-map-list.json')
      const originalSource = await fs.readFile(sourceFile, 'utf8')
      const restoreFiles = await snapshotFiles([sourceFile, classListFile, mapFile])
      if (!originalSource.includes(app.beforeClass)) {
        throw new Error(`${app.name} source file does not contain ${app.beforeClass}`)
      }

      let devServer: Awaited<ReturnType<typeof startViteDevServer>> | undefined
      const browser = await chromium.launch(resolveChromiumLaunchOptions({ headless: true }))
      const failures: unknown[] = []

      try {
        const seed = await seedHmrPatch(app.appDir)
        expect(seed.classList).toContain(app.beforeClass)

        devServer = await startViteDevServer(app.appDir, basePort + index)
        const page = await browser.newPage()
        await page.goto(devServer.url, {
          waitUntil: 'load',
          timeout: 120_000,
        })
        await page.waitForFunction(() => {
          const collect = (root: Document | ShadowRoot): number => {
            let total = root.querySelectorAll('[class]').length
            const elements = root.querySelectorAll<HTMLElement>('*')
            for (const element of [...elements]) {
              if (element.shadowRoot) {
                total += collect(element.shadowRoot)
              }
            }
            return total
          }
          return collect(document) > 0
        }, undefined, { timeout: 30_000 })

        const updatedSource = originalSource.replaceAll(app.beforeClass, app.afterClass)
        await fs.writeFile(sourceFile, updatedSource, 'utf8')

        await page.waitForFunction((afterClass) => {
          const classes = new Set<string>()
          const cssRules: string[] = []
          const escapedSelector = `.${CSS.escape(afterClass)}`
          const collectStyleSheets = (styleSheets: Iterable<StyleSheet>) => {
            for (const styleSheet of styleSheets) {
              try {
                const rules = (styleSheet as CSSStyleSheet).cssRules
                for (const rule of [...rules]) {
                  cssRules.push(rule.cssText)
                }
              }
              catch {
                // Ignore unreadable stylesheets.
              }
            }
          }
          const collect = (root: Document | ShadowRoot) => {
            collectStyleSheets(root instanceof Document ? [...root.styleSheets] : root.adoptedStyleSheets)
            const styles = root.querySelectorAll('style')
            for (const style of [...styles]) {
              cssRules.push(style.textContent ?? '')
            }
            const classElements = root.querySelectorAll<HTMLElement>('[class]')
            for (const element of [...classElements]) {
              for (const className of [...element.classList]) {
                classes.add(className)
              }
            }
            const elements = root.querySelectorAll<HTMLElement>('*')
            for (const element of [...elements]) {
              if (element.shadowRoot) {
                collect(element.shadowRoot)
              }
            }
          }
          collect(document)
          return classes.has(afterClass) || cssRules.join('\n').includes(escapedSelector)
        }, app.afterClass, { timeout: 60_000 })

        const updatedClasses = await snapshotDomClasses(page)
        if (app.expectDomUpdate !== false) {
          expect(updatedClasses).toContain(app.afterClass)
          expect(updatedClasses).not.toContain(app.beforeClass)
        }

        expect(await hasDevCssSelector(page, app.afterClass)).toBe(true)
      }
      catch (error) {
        failures.push(error)
      }
      finally {
        const cleanupResults = await Promise.allSettled([
          browser.close(),
          ...(devServer ? [stopRunningCommand(devServer.child)] : []),
        ])
        failures.push(...cleanupResults.flatMap(result => result.status === 'rejected' ? [result.reason] : []))
        try {
          await restoreFiles()
        }
        catch (error) {
          failures.push(error)
        }
      }
      if (failures.length > 0) {
        throw new AggregateError(failures, 'HMR E2E or resource cleanup failed')
      }
    }, 180_000)
  }
})

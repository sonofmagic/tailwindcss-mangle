import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'
import path from 'pathe'
import {
  hasDevCssSelector,
  hmrCases,
  restoreSourceFile,
  seedHmrPatch,
  snapshotDomClasses,
  startViteDevServer,
  stopRunningCommand,
} from './apps.hmr.shared'
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
      const originalClassList = await fs.readFile(classListFile, 'utf8').catch(() => undefined)
      const originalMap = await fs.readFile(mapFile, 'utf8').catch(() => undefined)
      if (!originalSource.includes(app.beforeClass)) {
        throw new Error(`${app.name} source file does not contain ${app.beforeClass}`)
      }

      let devServer: Awaited<ReturnType<typeof startViteDevServer>> | undefined
      const browser = await chromium.launch(resolveChromiumLaunchOptions({ headless: true }))

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
      finally {
        await restoreSourceFile(sourceFile, originalSource)
        if (originalClassList === undefined) {
          await fs.rm(classListFile, { force: true })
        }
        else {
          await fs.writeFile(classListFile, originalClassList, 'utf8')
        }
        if (originalMap === undefined) {
          await fs.rm(mapFile, { force: true })
        }
        else {
          await fs.writeFile(mapFile, originalMap, 'utf8')
        }
        await browser.close()
        if (devServer) {
          await stopRunningCommand(devServer.child)
        }
      }
    }, 180_000)
  }
})

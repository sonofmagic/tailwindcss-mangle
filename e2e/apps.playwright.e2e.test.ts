import type { RunningCommand } from './process'
import fs from 'node:fs/promises'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { buildApp, cases, createAppCommandEnv, ensureClassList, hasCssSelector, readClassListFile, readMappingFile, repoRoot, resolveClassListFile, resolveMapFile, resolveServeCommand, runTailwindcssPatch } from './apps.e2e.shared'
import { resolveChromiumLaunchOptions } from './playwright.shared'
import { spawnCommand } from './process'

const runPlaywrightE2E = process.env['TWM_APPS_E2E_PLAYWRIGHT'] === '1'
const basePort = 4200

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitForHttpReady(url: string, child: RunningCommand, timeoutMs = 120_000) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      const result = await child.completed
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
        .trim()
      throw new Error(`Server exited before ready at ${url}: ${output}`)
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      })
      if (response.status < 500) {
        return
      }
      lastError = new Error(`status ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await sleep(1000)
  }

  throw new Error(`Timed out waiting for server ${url}. Last error: ${String(lastError)}`)
}

async function startServer(appIndex: number) {
  const app = cases[appIndex]
  if (!app) {
    throw new Error(`Unknown e2e app index: ${appIndex}`)
  }
  const port = basePort + appIndex
  const url = `http://127.0.0.1:${port}/`
  let cmd: string
  let args: string[]
  let cwd = repoRoot
  let extraEnv: Record<string, string> = {}

  if (app.name === 'nuxt-app') {
    cmd = 'pnpm'
    args = ['exec', 'node', '.output/server/index.mjs']
    cwd = app.appDir
    extraEnv = {
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
    }
  }
  else if (app.name === 'remix-app') {
    cmd = 'pnpm'
    args = ['exec', 'remix-serve', 'build/index.js']
    cwd = app.appDir
    extraEnv = {
      HOST: '127.0.0.1',
      PORT: String(port),
    }
  }
  else {
    const serveCommand = resolveServeCommand(app, port)
    cmd = serveCommand[0]
    args = [...serveCommand[1]]
    cwd = serveCommand[2].cwd
  }

  const child = spawnCommand(cmd, args, {
    cwd,
    env: createAppCommandEnv({
      NODE_ENV: 'production',
      ...app.env,
      ...extraEnv,
    }),
  })

  await waitForHttpReady(url, child)
  return {
    child,
    url,
  }
}

async function stopServer(child: RunningCommand) {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([child.completed, sleep(5000)])
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([child.completed, sleep(3000)])
  }
}

describe.runIf(runPlaywrightE2E)('apps playwright e2e', () => {
  for (const [index, app] of cases.entries()) {
    it(`verifies ${app.name} mangled classes in browser`, async () => {
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

      const mappings = app.expectMangledOutput
        ? await readMappingFile(app.appDir)
        : []
      if (app.expectMangledOutput) {
        expect(mappings.length).toBeGreaterThan(0)
      }

      const { child, url } = await startServer(index)
      const browser = await chromium.launch(resolveChromiumLaunchOptions({
        headless: true,
      }))

      try {
        const page = await browser.newPage()
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        })
        await page.waitForSelector('body', { timeout: 30_000 })
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

        const domClasses = await page.evaluate(() => {
          const classes = new Set<string>()
          const collect = (root: Document | ShadowRoot) => {
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
          return [...classes]
        })
        expect(domClasses.length).toBeGreaterThan(0)

        const domClassSet = new Set(domClasses)
        if (!app.expectMangledOutput) {
          expect(domClassSet.has(app.expectedOriginalClass)).toBe(true)
          return
        }

        const mappedClassesInDom = mappings.filter(item => domClassSet.has(item.mangled))
        const expectedMapping = mappings.find(item => item.original === app.expectedOriginalClass)
        expect(expectedMapping).toBeDefined()
        const mappedClassesForValidation = mappedClassesInDom.length > 0
          ? mappedClassesInDom
          : [expectedMapping!]

        const cssText = await page.evaluate(() => {
          const cssRules: string[] = []
          const collectStyleSheets = (styleSheets: Iterable<StyleSheet>) => {
            for (const styleSheet of styleSheets) {
              try {
                const rules = (styleSheet as CSSStyleSheet).cssRules
                for (const rule of [...rules]) {
                  cssRules.push(rule.cssText)
                }
              }
              catch {
                // Ignore cross-origin or unreadable stylesheet.
              }
            }
          }
          const collect = (root: Document | ShadowRoot) => {
            collectStyleSheets(root instanceof Document ? [...root.styleSheets] : root.adoptedStyleSheets)
            const styles = root.querySelectorAll('style')
            for (const style of [...styles]) {
              cssRules.push(style.textContent ?? '')
            }
            const elements = root.querySelectorAll<HTMLElement>('*')
            for (const element of [...elements]) {
              if (element.shadowRoot) {
                collect(element.shadowRoot)
              }
            }
          }
          collect(document)
          return cssRules.join('\n')
        })

        const missing = mappedClassesForValidation.filter(item => !hasCssSelector(cssText, item.mangled))
        expect(
          missing,
          `Missing runtime css selectors in ${app.name}: ${missing
            .slice(0, 10)
            .map(item => `${item.original}->${item.mangled}`)
            .join(', ')}`,
        ).toEqual([])
      }
      finally {
        await browser.close()
        await stopServer(child)
      }
    }, 420_000)
  }
})

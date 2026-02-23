import fs from 'node:fs/promises'
import process from 'node:process'
import { chromium } from '@playwright/test'
import { execa, type ExecaChildProcess } from 'execa'
import { buildApp, cases, ensureClassList, readMappingFile, repoRoot, resolveMapFile, resolveServeCommand } from './apps.e2e.shared'

const runPlaywrightE2E = process.env.TWM_APPS_E2E_PLAYWRIGHT === '1'
const basePort = 4200

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasCssSelector(css: string, className: string) {
  const escaped = escapeRegExp(className)
  return new RegExp(`\\.${escaped}(?=[^A-Za-z0-9_-]|$)`).test(css)
}

async function waitForHttpReady(url: string, child: ExecaChildProcess, timeoutMs = 120_000) {
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      const result = await child
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
  const port = basePort + appIndex
  const url = `http://127.0.0.1:${port}/`
  let cmd: string
  let args: string[]
  let extraEnv: Record<string, string> = {}

  if (app.name === 'nuxt-app') {
    cmd = 'pnpm'
    args = ['--dir', app.appDir, 'exec', 'node', '.output/server/index.mjs']
    extraEnv = {
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(port),
    }
  }
  else {
    const serveCommand = resolveServeCommand(app, port)
    cmd = serveCommand[0]
    args = [...serveCommand[1]]
  }

  const child = execa(cmd, args, {
    cwd: repoRoot,
    reject: false,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...app.env,
      ...extraEnv,
    },
  })

  await waitForHttpReady(url, child)
  return {
    child,
    url,
  }
}

async function stopServer(child: ExecaChildProcess) {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([child, sleep(5000)])
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([child, sleep(3000)])
  }
}

describe.runIf(runPlaywrightE2E)('apps playwright e2e', () => {
  for (let index = 0; index < cases.length; index++) {
    const app = cases[index]
    it(`verifies ${app.name} mangled classes in browser`, async () => {
      const mapFile = resolveMapFile(app.appDir)
      await ensureClassList(app)
      await fs.rm(mapFile, { force: true })
      await buildApp(app)

      const mappings = await readMappingFile(app.appDir)
      expect(mappings.length).toBeGreaterThan(0)

      const { child, url } = await startServer(index)
      const browser = await chromium.launch({
        headless: true,
        channel: 'chrome',
      })

      try {
        const page = await browser.newPage()
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 120_000,
        })
        await page.waitForSelector('body', { timeout: 30_000 })

        const domClasses = await page.evaluate(() => {
          const classes = new Set<string>()
          const elements = document.querySelectorAll<HTMLElement>('[class]')
          for (const element of Array.from(elements)) {
            for (const className of Array.from(element.classList)) {
              classes.add(className)
            }
          }
          return Array.from(classes)
        })
        expect(domClasses.length).toBeGreaterThan(0)

        const domClassSet = new Set(domClasses)
        const mappedClassesInDom = mappings.filter(item => domClassSet.has(item.mangled))
        const expectedMapping = mappings.find(item => item.original === app.expectedOriginalClass)
        expect(expectedMapping).toBeDefined()
        const mappedClassesForValidation = mappedClassesInDom.length > 0
          ? mappedClassesInDom
          : [expectedMapping!]

        const cssText = await page.evaluate(() => {
          const cssRules: string[] = []
          for (const styleSheet of Array.from(document.styleSheets)) {
            try {
              const rules = (styleSheet as CSSStyleSheet).cssRules
              for (const rule of Array.from(rules)) {
                cssRules.push(rule.cssText)
              }
            }
            catch {
              // Ignore cross-origin or unreadable stylesheet.
            }
          }
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

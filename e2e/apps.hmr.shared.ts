import type { RunningCommand } from './process'
import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { cases, hasCssSelector, readClassListFile, repoRoot, resolveClassListFile, resolveMapFile, runTailwindcssPatch } from './apps.e2e.shared'
import { spawnCommand } from './process'

export interface AppHmrCase {
  name: string
  appDir: string
  sourceFile: string
  beforeClass: string
  afterClass: string
  expectDomUpdate?: boolean
}

const host = '127.0.0.1'

export const hmrCases: AppHmrCase[] = [
  {
    name: 'vite-vue',
    appDir: path.resolve(repoRoot, 'apps/vite-vue'),
    sourceFile: 'src/App.vue',
    beforeClass: 'bg-red-200',
    afterClass: 'bg-emerald-200',
  },
  {
    name: 'vite-react',
    appDir: path.resolve(repoRoot, 'apps/vite-react'),
    sourceFile: 'src/App.tsx',
    beforeClass: 'bg-red-100',
    afterClass: 'bg-emerald-100',
    expectDomUpdate: false,
  },
  {
    name: 'vite-svelte',
    appDir: path.resolve(repoRoot, 'apps/vite-svelte'),
    sourceFile: 'src/App.svelte',
    beforeClass: 'text-[40px]',
    afterClass: 'text-[44px]',
    expectDomUpdate: false,
  },
  {
    name: 'vite-vanilla',
    appDir: path.resolve(repoRoot, 'apps/vite-vanilla'),
    sourceFile: 'src/main.ts',
    beforeClass: 'dark:bg-zinc-800/30',
    afterClass: 'dark:bg-zinc-700/30',
  },
  {
    name: 'vite-lit',
    appDir: path.resolve(repoRoot, 'apps/vite-lit'),
    sourceFile: 'src/my-element.ts',
    beforeClass: 'dark:bg-zinc-800/30',
    afterClass: 'dark:bg-zinc-700/30',
  },
  {
    name: 'solid-app',
    appDir: path.resolve(repoRoot, 'apps/solid-app'),
    sourceFile: 'src/App.tsx',
    beforeClass: 'dark:bg-zinc-800/30',
    afterClass: 'dark:bg-zinc-700/30',
  },
]

export async function startViteDevServer(appDir: string, port: number) {
  const child = spawnCommand('pnpm', ['--dir', appDir, 'dev', '--host', host, '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  })

  const url = `http://${host}:${port}/`
  const startedAt = Date.now()
  let lastError: unknown

  while (Date.now() - startedAt < 120_000) {
    if (child.exitCode !== null) {
      const result = await child.completed
      const output = [result.stdout, result.stderr]
        .filter(Boolean)
        .join('\n')
        .trim()
      throw new Error(`Dev server exited before ready at ${url}: ${output}`)
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      })
      if (response.status < 500) {
        return {
          child,
          url,
        }
      }
      lastError = new Error(`status ${response.status}`)
    }
    catch (error) {
      lastError = error
    }

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error(`Timed out waiting for dev server ${url}. Last error: ${String(lastError)}`)
}

export async function stopRunningCommand(child: RunningCommand) {
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([child.completed, new Promise(resolve => setTimeout(resolve, 5000))])
  }
  if (child.exitCode === null) {
    child.kill('SIGKILL')
    await Promise.race([child.completed, new Promise(resolve => setTimeout(resolve, 3000))])
  }
}

export async function snapshotDomClasses(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
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
}

export async function snapshotDevCss(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
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
}

export async function hasDevCssSelector(page: import('@playwright/test').Page, className: string) {
  return page.evaluate((targetClassName) => {
    const escapedSelector = `.${CSS.escape(targetClassName)}`
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
      const elements = root.querySelectorAll<HTMLElement>('*')
      for (const element of [...elements]) {
        if (element.shadowRoot) {
          collect(element.shadowRoot)
        }
      }
    }
    collect(document)
    return cssRules.join('\n').includes(escapedSelector)
  }, className)
}

export async function seedHmrPatch(appDir: string) {
  const app = cases.find(item => item.appDir === appDir)
  if (!app) {
    throw new Error(`Unable to find app e2e case for ${appDir}`)
  }
  await runTailwindcssPatch(app)

  return {
    classListFile: resolveClassListFile(appDir),
    mapFile: resolveMapFile(appDir),
    classList: await readClassListFile(appDir),
  }
}

export async function restoreSourceFile(sourceFile: string, originalContent: string) {
  await fs.writeFile(sourceFile, originalContent, 'utf8')
}

export { cases as appCases, hasCssSelector }

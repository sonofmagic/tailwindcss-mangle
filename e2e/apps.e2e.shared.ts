import fs from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'
import { runCommand } from './process'

export interface MappingEntry {
  original: string
  mangled: string
  usedBy: string[]
}

export interface AppServeConfig {
  script: 'preview' | 'start'
  args: (port: number) => string[]
}

export interface AppE2ECase {
  name: string
  appDir: string
  expectedOriginalClass: string
  buildScript?: string
  outputDirs: string[]
  usageDirs?: string[]
  classListSeed?: string[]
  usesTailwindcssPatch: boolean
  usesUnpluginTailwindcssMangle: boolean
  expectMangledOutput: boolean
  env?: Record<string, string>
  serve?: AppServeConfig
}

export const repoRoot = path.resolve(__dirname, '..')

const host = '127.0.0.1'
export const appCommandPnpmfile = path.resolve(repoRoot, 'e2e/noop-pnpmfile.mjs')

export function createAppCommandEnv(
  env: Record<string, string | undefined> = {},
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NPM_CONFIG_PNPMFILE: appCommandPnpmfile,
    npm_config_pnpmfile: appCommandPnpmfile,
    ...env,
  }
}

export const defaultServeConfig: AppServeConfig = {
  script: 'preview',
  args: port => ['--host', host, '--port', String(port)],
}

export const cases: AppE2ECase[] = [
  {
    name: 'vite-vue',
    appDir: path.resolve(repoRoot, 'apps/vite-vue'),
    expectedOriginalClass: 'bg-red-200',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'vite-react',
    appDir: path.resolve(repoRoot, 'apps/vite-react'),
    expectedOriginalClass: 'hover:bg-red-800',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'vite-svelte',
    appDir: path.resolve(repoRoot, 'apps/vite-svelte'),
    expectedOriginalClass: 'text-[40px]',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'vite-vanilla',
    appDir: path.resolve(repoRoot, 'apps/vite-vanilla'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'vite-lit',
    appDir: path.resolve(repoRoot, 'apps/vite-lit'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'solid-app',
    appDir: path.resolve(repoRoot, 'apps/solid-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'nuxt-app',
    appDir: path.resolve(repoRoot, 'apps/nuxt-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['.output/public'],
    usageDirs: ['.output/public', '.output/server'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
    serve: {
      script: 'preview',
      args: port => ['--port', String(port)],
    },
  },
  {
    name: 'astro-app',
    appDir: path.resolve(repoRoot, 'apps/astro-app'),
    expectedOriginalClass: 'bg-red-500',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: '--import tsx',
    },
  },
  {
    name: 'next-app',
    appDir: path.resolve(repoRoot, 'apps/next-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['.next/static'],
    usageDirs: ['.next/static', '.next/server'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
    serve: {
      script: 'start',
      args: port => ['--hostname', host, '--port', String(port)],
    },
  },
  {
    name: 'next-app-router',
    appDir: path.resolve(repoRoot, 'apps/next-app-router'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['.next/static'],
    usageDirs: ['.next/static', '.next/server'],
    classListSeed: ['dark:bg-zinc-800/30'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
    serve: {
      script: 'start',
      args: port => ['--hostname', host, '--port', String(port)],
    },
  },
  {
    name: 'webpack5-vue3',
    appDir: path.resolve(repoRoot, 'apps/webpack5-vue3'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['dist'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: true,
    expectMangledOutput: true,
  },
  {
    name: 'remix-app',
    appDir: path.resolve(repoRoot, 'apps/remix-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['public/build'],
    usageDirs: ['public/build', 'build'],
    usesTailwindcssPatch: true,
    usesUnpluginTailwindcssMangle: false,
    expectMangledOutput: false,
    serve: {
      script: 'start',
      args: port => ['--host', host, '--port', String(port)],
    },
  },
]

export function resolveMapFile(appDir: string) {
  return path.resolve(appDir, '.tw-patch/tw-map-list.json')
}

export function resolveClassListFile(appDir: string) {
  return path.resolve(appDir, '.tw-patch/tw-class-list.json')
}

export async function readMappingFile(appDir: string) {
  const mapFile = resolveMapFile(appDir)
  const raw = await fs.readFile(mapFile, 'utf8')
  return JSON.parse(raw) as MappingEntry[]
}

export async function readClassListFile(appDir: string) {
  const classListFile = resolveClassListFile(appDir)
  const raw = await fs.readFile(classListFile, 'utf8')
  return JSON.parse(raw) as string[]
}

export async function ensureClassList(app: AppE2ECase) {
  if (!app.classListSeed || app.classListSeed.length === 0) {
    return
  }

  const classListFile = resolveClassListFile(app.appDir)

  try {
    const raw = await fs.readFile(classListFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return
    }
  }
  catch {
    // no-op, we'll seed it below.
  }

  await fs.mkdir(path.dirname(classListFile), { recursive: true })
  await fs.writeFile(classListFile, `${JSON.stringify(app.classListSeed, null, 2)}\n`, 'utf8')
}

export async function buildApp(app: AppE2ECase) {
  await runCommand('pnpm', ['run', app.buildScript ?? 'build'], {
    cwd: app.appDir,
    env: createAppCommandEnv({
      NODE_ENV: 'production',
      ...app.env,
    }),
  })
}

export async function runTailwindcssPatch(app: AppE2ECase) {
  await runCommand('pnpm', ['exec', 'tw-patch', 'install'], {
    cwd: app.appDir,
    env: createAppCommandEnv({
      NODE_ENV: 'production',
      ...app.env,
    }),
  })
  await runCommand('pnpm', ['exec', 'tw-patch', 'extract'], {
    cwd: app.appDir,
    env: createAppCommandEnv({
      NODE_ENV: 'production',
      ...app.env,
    }),
  })
}

async function resolveDirs(appDir: string, dirs: string[]) {
  const outputRoots: string[] = []

  for (const dir of dirs) {
    const outputDir = path.resolve(appDir, dir)
    try {
      const stat = await fs.stat(outputDir)
      if (stat.isDirectory()) {
        outputRoots.push(outputDir)
      }
    }
    catch {
      // ignore missing output directories
    }
  }

  return outputRoots
}

export async function resolveOutputRoots(app: AppE2ECase) {
  return resolveDirs(app.appDir, app.outputDirs)
}

export async function resolveUsageRoots(app: AppE2ECase) {
  return resolveDirs(app.appDir, app.usageDirs ?? app.outputDirs)
}

export function resolveServeCommand(app: AppE2ECase, port: number) {
  const serve = app.serve ?? defaultServeConfig
  return ['pnpm', ['run', serve.script, ...serve.args(port)], { cwd: app.appDir }] as const
}

export const usageExt = new Set([
  '.html',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.txt',
])

export function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasClassUsage(content: string, className: string) {
  const escaped = escapeRegExp(className)
  return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}(?=[^A-Za-z0-9_-]|$)`).test(content)
}

export function hasCssSelector(css: string, className: string) {
  const escaped = escapeRegExp(className)
  return new RegExp(`\\.${escaped}(?=[^A-Za-z0-9_-]|$)`).test(css)
}

export function extractInlineStyles(html: string) {
  let css = ''
  const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let match = styleRegex.exec(html)
  while (match !== null) {
    css += `\n${match[1]}`
    match = styleRegex.exec(html)
  }
  return css
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
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

export async function collectUsageText(usageRoots: string[]) {
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

export async function collectCssText(outputRoots: string[]) {
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

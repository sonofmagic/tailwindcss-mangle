import fs from 'node:fs/promises'
import { execa } from 'execa'
import path from 'pathe'

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
  outputDirs: string[]
  usageDirs?: string[]
  classListSeed?: string[]
  env?: Record<string, string>
  serve?: AppServeConfig
}

export const repoRoot = path.resolve(__dirname, '../../..')

const host = '127.0.0.1'

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
  },
  {
    name: 'vite-react',
    appDir: path.resolve(repoRoot, 'apps/vite-react'),
    expectedOriginalClass: 'hover:bg-red-800',
    outputDirs: ['dist'],
  },
  {
    name: 'vite-svelte',
    appDir: path.resolve(repoRoot, 'apps/vite-svelte'),
    expectedOriginalClass: 'text-[40px]',
    outputDirs: ['dist'],
  },
  {
    name: 'vite-vanilla',
    appDir: path.resolve(repoRoot, 'apps/vite-vanilla'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['dist'],
  },
  {
    name: 'nuxt-app',
    appDir: path.resolve(repoRoot, 'apps/nuxt-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    outputDirs: ['.output/public'],
    usageDirs: ['.output/public', '.output/server'],
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
  },
]

export function resolveMapFile(appDir: string) {
  return path.resolve(appDir, '.tw-patch/tw-map-list.json')
}

export async function readMappingFile(appDir: string) {
  const mapFile = resolveMapFile(appDir)
  const raw = await fs.readFile(mapFile, 'utf8')
  return JSON.parse(raw) as MappingEntry[]
}

export async function ensureClassList(app: AppE2ECase) {
  if (!app.classListSeed || app.classListSeed.length === 0) {
    return
  }

  const classListFile = path.resolve(app.appDir, '.tw-patch/tw-class-list.json')

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
  await execa('pnpm', ['--dir', app.appDir, 'build'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ...app.env,
    },
  })
}

export async function resolveOutputRoots(app: AppE2ECase) {
  return resolveDirs(app.appDir, app.outputDirs)
}

export async function resolveUsageRoots(app: AppE2ECase) {
  return resolveDirs(app.appDir, app.usageDirs ?? app.outputDirs)
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

export function resolveServeCommand(app: AppE2ECase, port: number) {
  const serve = app.serve ?? defaultServeConfig
  return ['pnpm', ['--dir', app.appDir, serve.script, ...serve.args(port)]] as const
}

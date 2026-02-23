import fs from 'node:fs/promises'
import { execa } from 'execa'
import path from 'pathe'

interface MappingEntry {
  original: string
  mangled: string
  usedBy: string[]
}

interface AppE2ECase {
  name: string
  appDir: string
  expectedOriginalClass: string
  classListSeed?: string[]
  env?: Record<string, string>
}

const repoRoot = path.resolve(__dirname, '../../..')
const runAppsE2E = process.env.TWM_APPS_E2E === '1'
const cases: AppE2ECase[] = [
  {
    name: 'vite-vue',
    appDir: path.resolve(repoRoot, 'apps/vite-vue'),
    expectedOriginalClass: 'bg-red-200',
  },
  {
    name: 'vite-react',
    appDir: path.resolve(repoRoot, 'apps/vite-react'),
    expectedOriginalClass: 'hover:bg-red-800',
  },
  {
    name: 'vite-svelte',
    appDir: path.resolve(repoRoot, 'apps/vite-svelte'),
    expectedOriginalClass: 'text-[40px]',
  },
  {
    name: 'vite-vanilla',
    appDir: path.resolve(repoRoot, 'apps/vite-vanilla'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
  },
  {
    name: 'nuxt-app',
    appDir: path.resolve(repoRoot, 'apps/nuxt-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
  },
  {
    name: 'astro-app',
    appDir: path.resolve(repoRoot, 'apps/astro-app'),
    expectedOriginalClass: 'bg-red-500',
    env: {
      ASTRO_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: '--import tsx',
    },
  },
  {
    name: 'next-app',
    appDir: path.resolve(repoRoot, 'apps/next-app'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
  {
    name: 'next-app-router',
    appDir: path.resolve(repoRoot, 'apps/next-app-router'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
    classListSeed: ['dark:bg-zinc-800/30'],
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
  {
    name: 'webpack5-vue3',
    appDir: path.resolve(repoRoot, 'apps/webpack5-vue3'),
    expectedOriginalClass: 'dark:bg-zinc-800/30',
  },
]

async function readMappingFile(appDir: string) {
  const mapFile = path.resolve(appDir, '.tw-patch/tw-map-list.json')
  const raw = await fs.readFile(mapFile, 'utf8')
  return JSON.parse(raw) as MappingEntry[]
}

async function ensureClassList(app: AppE2ECase) {
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

describe.runIf(runAppsE2E)('apps integration e2e', () => {
  for (const app of cases) {
    it(`builds ${app.name} and emits mapping`, async () => {
      const mapFile = path.resolve(app.appDir, '.tw-patch/tw-map-list.json')

      await ensureClassList(app)
      await fs.rm(mapFile, { force: true })

      await execa('pnpm', ['--dir', app.appDir, 'build'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          ...app.env,
        },
      })

      const mappings = await readMappingFile(app.appDir)
      expect(mappings.length).toBeGreaterThan(0)

      const expected = mappings.find(item => item.original === app.expectedOriginalClass)
      expect(expected).toBeDefined()
      expect(expected?.mangled.startsWith('tw-')).toBe(true)
      expect(Array.isArray(expected?.usedBy)).toBe(true)
    }, 300_000)
  }
})

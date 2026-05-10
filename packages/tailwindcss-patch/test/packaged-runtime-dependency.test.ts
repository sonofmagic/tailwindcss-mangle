import { execFileSync } from 'node:child_process'
import fsSync, { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const packageDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageDir, '../..')

let tempDir: string

function run(command: string, args: string[], cwd: string, timeout = 180_000) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '1',
        npm_config_update_notifier: 'false',
      },
      timeout,
    }).trim()
  }
  catch (error) {
    const output = error && typeof error === 'object'
      ? [
          'stdout' in error ? String(error.stdout ?? '') : '',
          'stderr' in error ? String(error.stderr ?? '') : '',
        ].filter(Boolean).join('\n')
      : ''
    throw new Error(`${command} ${args.join(' ')} failed\n${output}`)
  }
}

async function packTailwindcssPatch() {
  const packDir = path.join(tempDir, 'pack')
  await fs.mkdir(packDir, { recursive: true })
  const output = run('pnpm', ['--dir', packageDir, 'pack', '--json', '--pack-destination', packDir], repoRoot)
  const result = JSON.parse(output) as { filename: string }
  return result.filename
}

async function createProject(name: string) {
  const projectDir = path.join(tempDir, name)
  await fs.mkdir(projectDir, { recursive: true })
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    `${JSON.stringify({
      name,
      private: true,
      type: 'module',
    }, null, 2)}\n`,
    'utf8',
  )
  return projectDir
}

function installProject(projectDir: string, tarball: string, tailwindVersion: string) {
  run('pnpm', [
    'add',
    '--ignore-workspace',
    tarball,
    `tailwindcss@${tailwindVersion}`,
  ], projectDir)
}

function runProjectScript(projectDir: string, source: string) {
  const scriptPath = path.join(projectDir, 'run.mjs')
  fsSync.writeFileSync(scriptPath, source, 'utf8')
  return JSON.parse(run(process.execPath, [scriptPath], projectDir))
}

describe('packed tailwindcss-patch runtime dependencies', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-packaged-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { force: true, recursive: true })
  })

  it('publishes @tailwindcss/oxide as a runtime dependency for package-manager installs', async () => {
    const tarball = await packTailwindcssPatch()
    const manifest = JSON.parse(
      run('tar', ['-xOf', tarball, 'package/package.json'], repoRoot),
    )
    const packageManifest = JSON.parse(
      await fs.readFile(path.join(packageDir, 'package.json'), 'utf8'),
    )

    expect(manifest.dependencies['@tailwindcss/oxide']).toBe(
      packageManifest.dependencies['@tailwindcss/oxide'],
    )
    expect(manifest.devDependencies?.['@tailwindcss/oxide']).toBeUndefined()

    const oxideManifestPath = require.resolve('@tailwindcss/oxide/package.json')
    const oxideManifest = JSON.parse(await fs.readFile(oxideManifestPath, 'utf8'))
    expect(Object.keys(oxideManifest.optionalDependencies ?? {}).length).toBeGreaterThan(0)
  })

  it('runs source candidate scanning from a clean Tailwind CSS v3.4.19 project without explicitly installing oxide', async () => {
    const tarball = await packTailwindcssPatch()
    const projectDir = await createProject('tailwind-v3-consumer')
    installProject(projectDir, tarball, '3.4.19')

    const result = runProjectScript(projectDir, `
      import fs from 'node:fs/promises'
      import path from 'node:path'
      import { createRequire } from 'node:module'
      import { TailwindcssPatcher } from 'tailwindcss-patch'

      const cwd = process.cwd()
      await fs.writeFile(path.join(cwd, 'page.html'), '<div class="text-red-500 font-bold unknown-token"></div>')

      const require = createRequire(import.meta.url)
      const oxidePackageJson = require.resolve('@tailwindcss/oxide/package.json')
      const patcher = new TailwindcssPatcher({
        projectRoot: cwd,
        cache: false,
        apply: { overwrite: false },
        tailwindcss: { version: 3 },
      })
      const report = await patcher.collectContentTokens({
        cwd,
        sources: [{ base: cwd, pattern: 'page.html', negated: false }],
      })

      console.log(JSON.stringify({
        majorVersion: patcher.majorVersion,
        hasOxidePackage: oxidePackageJson.includes('node_modules'),
        rawCandidates: report.entries.map(entry => entry.rawCandidate),
      }))
    `)

    expect(result.majorVersion).toBe(3)
    expect(result.hasOxidePackage).toBe(true)
    expect(result.rawCandidates).toContain('text-red-500')
    expect(result.rawCandidates).toContain('font-bold')
  })

  it('keeps the Tailwind CSS v4 oxide source scanner path working from a clean project', async () => {
    const tarball = await packTailwindcssPatch()
    const projectDir = await createProject('tailwind-v4-consumer')
    installProject(projectDir, tarball, '4.2.4')

    const result = runProjectScript(projectDir, `
      import { createTailwindV4Engine, resolveTailwindV4Source } from 'tailwindcss-patch'

      const source = await resolveTailwindV4Source({
        projectRoot: process.cwd(),
        css: '@import "tailwindcss";',
        packageName: 'tailwindcss',
      })
      const engine = createTailwindV4Engine(source)
      const generated = await engine.generate({
        sources: [{ content: '<div class="text-red-500"></div>', extension: 'html' }],
      })

      console.log(JSON.stringify({
        rawCandidates: Array.from(generated.rawCandidates),
        classList: Array.from(generated.classSet),
        cssContainsUtility: generated.css.includes('.text-red-500'),
      }))
    `)

    expect(result.rawCandidates).toContain('text-red-500')
    expect(result.classList).toContain('text-red-500')
    expect(result.cssContainsUtility).toBe(true)
  })
})

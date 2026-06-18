import { execFileSync } from 'node:child_process'
import fsSync, { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const packageDir = path.resolve(__dirname, '..')
const repoRoot = path.resolve(packageDir, '../..')
const configPackageDir = path.resolve(repoRoot, 'packages/config')
const enginePackageDir = path.resolve(repoRoot, 'packages/engine')

let tempDir: string

function run(command: string, args: string[], cwd: string, timeout = 180_000, shell = false) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI: '1',
        npm_config_update_notifier: 'false',
      },
      shell,
      timeout,
    }).trim()
  }
  catch (error) {
    const output = error && typeof error === 'object'
      ? [
          'message' in error ? String(error.message ?? '') : '',
          'stdout' in error ? String(error.stdout ?? '') : '',
          'stderr' in error ? String(error.stderr ?? '') : '',
        ].filter(Boolean).join('\n')
      : ''
    throw new Error(`${command} ${args.join(' ')} failed\n${output}`)
  }
}

function runPnpm(args: string[], cwd: string, timeout?: number) {
  return run('pnpm', args, cwd, timeout, process.platform === 'win32')
}

async function packPackage(packageDirectory: string) {
  const packDir = path.join(tempDir, 'pack')
  await fs.mkdir(packDir, { recursive: true })
  const output = runPnpm(['pack', '--json', '--pack-destination', path.relative(packageDirectory, packDir)], packageDirectory)
  const result = JSON.parse(output) as { filename: string }
  return result.filename
}

async function packTailwindcssPatch() {
  return packPackage(packageDir)
}

async function packConsumerInstallTarballs() {
  const configTarball = await packPackage(configPackageDir)
  const engineTarball = await packPackage(enginePackageDir)
  const tailwindcssPatchTarball = await packTailwindcssPatch()
  return {
    config: configTarball,
    engine: engineTarball,
    tailwindcssPatch: tailwindcssPatchTarball,
  }
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

function installProject(
  projectDir: string,
  tarballs: { config: string, engine: string, tailwindcssPatch: string },
  tailwindVersion: string,
) {
  fsSync.writeFileSync(
    path.join(projectDir, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - .',
      'overrides:',
      `  '@tailwindcss-mangle/config': 'file:${tarballs.config}'`,
      `  '@tailwindcss-mangle/engine': 'file:${tarballs.engine}'`,
      '',
    ].join('\n'),
    'utf8',
  )

  runPnpm([
    'add',
    `@tailwindcss-mangle/config@file:${tarballs.config}`,
    `@tailwindcss-mangle/engine@file:${tarballs.engine}`,
  ], projectDir)

  runPnpm([
    'add',
    tarballs.tailwindcssPatch,
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

  it('delegates Tailwind v4 runtime dependencies to the engine package', async () => {
    const tarball = await packTailwindcssPatch()
    const engineTarball = await packPackage(enginePackageDir)
    const manifest = JSON.parse(
      run('tar', ['-xOf', tarball, 'package/package.json'], repoRoot),
    )
    const engineManifest = JSON.parse(
      run('tar', ['-xOf', engineTarball, 'package/package.json'], repoRoot),
    )

    expect(manifest.dependencies['@tailwindcss-mangle/engine']).toBe(engineManifest.version)
    expect(manifest.dependencies['@tailwindcss/node']).toBeUndefined()
    expect(manifest.dependencies['@tailwindcss/oxide']).toBeUndefined()
    expect(manifest.dependencies.micromatch).toBeUndefined()
    expect(engineManifest.dependencies['@tailwindcss/node']).toBeDefined()
    expect(engineManifest.dependencies['@tailwindcss/oxide']).toBeDefined()
    expect(manifest.devDependencies?.['@tailwindcss/oxide']).toBeUndefined()

    const oxideManifestPath = require.resolve('@tailwindcss/oxide/package.json')
    const oxideManifest = JSON.parse(await fs.readFile(oxideManifestPath, 'utf8'))
    expect(Object.keys(oxideManifest.optionalDependencies ?? {}).length).toBeGreaterThan(0)
  })

  it('runs source candidate scanning from a clean Tailwind CSS v3.4.19 project without explicitly installing oxide', async () => {
    const tarballs = await packConsumerInstallTarballs()
    const projectDir = await createProject('tailwind-v3-consumer')
    installProject(projectDir, tarballs, '3.4.19')

    const result = runProjectScript(projectDir, `
      import fs from 'node:fs/promises'
      import path from 'node:path'
      import { createRequire } from 'node:module'
      import { TailwindcssPatcher } from 'tailwindcss-patch'

      const cwd = process.cwd()
      await fs.writeFile(path.join(cwd, 'page.html'), '<div class="text-red-500 font-bold unknown-token"></div>')

      const require = createRequire(import.meta.url)
      const patchEntry = require.resolve('tailwindcss-patch')
      const patchRequire = createRequire(patchEntry)
      const engineEntry = patchRequire.resolve('@tailwindcss-mangle/engine')
      const engineRequire = createRequire(engineEntry)
      const oxidePackageJson = engineRequire.resolve('@tailwindcss/oxide/package.json')
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
    const tarballs = await packConsumerInstallTarballs()
    const projectDir = await createProject('tailwind-v4-consumer')
    installProject(projectDir, tarballs, '4.2.4')

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

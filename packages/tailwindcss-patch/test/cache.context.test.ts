import type { PackageInfo } from 'local-pkg'
import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCacheContextDescriptor, explainContextMismatch } from '@/cache/context'
import { normalizeOptions } from '@/options/normalize'

let tempDir: string
let originalCwd: string

function toPackageInfo(rootPath: string, version: string): PackageInfo {
  return {
    name: 'tailwindcss',
    rootPath,
    version,
  } as PackageInfo
}

beforeEach(async () => {
  originalCwd = process.cwd()
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-context-'))
})

afterEach(async () => {
  process.chdir(originalCwd)
  await fs.remove(tempDir)
})

describe('cache context fingerprint', () => {
  it('generates deterministic fingerprints with stable metadata', async () => {
    const projectRoot = path.join(tempDir, 'project')
    const packageRoot = path.join(tempDir, 'tailwind-pkg')
    await fs.ensureDir(projectRoot)
    await fs.ensureDir(packageRoot)
    await fs.writeFile(path.join(projectRoot, 'tailwind.config.js'), 'module.exports = { content: [] }', 'utf8')

    const normalized = normalizeOptions({
      cwd: projectRoot,
      cache: {
        enabled: true,
        dir: path.join(tempDir, '.cache'),
      },
      output: {
        enabled: false,
      },
      tailwind: {
        version: 3,
      },
    })

    process.chdir(projectRoot)

    const descriptor1 = createCacheContextDescriptor(normalized, toPackageInfo(packageRoot, '3.4.19'), 3)
    const descriptor2 = createCacheContextDescriptor(normalized, toPackageInfo(packageRoot, '3.4.19'), 3)

    expect(descriptor1.fingerprint).toBe(descriptor2.fingerprint)
    expect(descriptor1.metadata.tailwindConfigPath).toContain('tailwind.config.js')
    expect(descriptor1.metadata.tailwindConfigMtimeMs).toBeTypeOf('number')
  })

  it('changes fingerprint when key runtime metadata changes', async () => {
    const projectRoot = path.join(tempDir, 'project')
    const packageRootA = path.join(tempDir, 'tailwind-pkg-a')
    const packageRootB = path.join(tempDir, 'tailwind-pkg-b')
    await fs.ensureDir(projectRoot)
    await fs.ensureDir(packageRootA)
    await fs.ensureDir(packageRootB)
    await fs.writeFile(path.join(projectRoot, 'tailwind.config.js'), 'module.exports = { content: [] }', 'utf8')

    const normalized = normalizeOptions({
      cwd: projectRoot,
      cache: {
        enabled: true,
        dir: path.join(tempDir, '.cache'),
      },
      output: {
        enabled: false,
      },
      tailwind: {
        version: 3,
      },
    })

    process.chdir(projectRoot)

    const descriptorA = createCacheContextDescriptor(normalized, toPackageInfo(packageRootA, '3.4.18'), 3)
    const descriptorB = createCacheContextDescriptor(normalized, toPackageInfo(packageRootB, '3.4.19'), 3)

    expect(descriptorA.fingerprint).not.toBe(descriptorB.fingerprint)
  })

  it('explains mismatch reasons and returns empty for identical metadata', () => {
    const base = {
      fingerprintVersion: 1 as const,
      projectRootRealpath: '/a',
      processCwdRealpath: '/a',
      cacheCwdRealpath: '/a',
      tailwindConfigPath: '/a/tailwind.config.js',
      tailwindConfigMtimeMs: 1,
      tailwindPackageRootRealpath: '/pkg',
      tailwindPackageVersion: '3.4.19',
      patcherVersion: '8.6.1',
      majorVersion: 3 as const,
      optionsHash: 'abc',
    }

    expect(explainContextMismatch(base, base)).toEqual([])

    const changed = {
      ...base,
      projectRootRealpath: '/b',
      tailwindPackageVersion: '3.4.20',
      optionsHash: 'def',
    }

    const reasons = explainContextMismatch(changed, base)
    expect(reasons.some(x => x.includes('project-root changed'))).toBe(true)
    expect(reasons.some(x => x.includes('tailwind-package version changed'))).toBe(true)
    expect(reasons.some(x => x.includes('patch options hash changed'))).toBe(true)
  })
})

import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-constructor-'))
})

afterEach(async () => {
  vi.resetModules()
  vi.restoreAllMocks()
  vi.unmock('local-pkg')
  await fs.remove(tempDir)
})

function createPkgInfo(version: string) {
  return {
    name: 'tailwindcss',
    version,
    rootPath: tempDir,
  }
}

async function importPatcherWithPackageResolver(
  resolver: () => ReturnType<typeof createPkgInfo> | undefined,
) {
  vi.doMock('local-pkg', async () => {
    const actual = await vi.importActual<typeof import('local-pkg')>('local-pkg')
    return {
      ...actual,
      getPackageInfoSync: vi.fn(resolver),
    }
  })

  return import('@/api/tailwindcss-patcher')
}

describe('TailwindcssPatcher constructor branches', () => {
  it('throws when tailwind package cannot be resolved', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => undefined)
    expect(() => new TailwindcssPatcher({
      tailwind: {
        packageName: 'tailwindcss-missing',
      },
    })).toThrow('Unable to locate Tailwind CSS package')
  })

  it('caps unknown future major versions to v4 for compatibility', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('5.0.1'))
    const patcher = new TailwindcssPatcher({
      cache: false,
      output: {
        enabled: false,
      },
    })
    expect(patcher.majorVersion).toBe(4)
  })

  it('falls back to v3 when installed package version is not semver', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('canary'))
    const patcher = new TailwindcssPatcher({
      cache: false,
      output: {
        enabled: false,
      },
    })
    expect(patcher.majorVersion).toBe(3)
  })

  it('accepts legacy options wrapper and honors explicit version hint', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('5.0.1'))
    const patcher = new TailwindcssPatcher({
      patch: {
        tailwindcss: {
          version: 2,
        },
      },
    })
    expect(patcher.majorVersion).toBe(2)
  })
})

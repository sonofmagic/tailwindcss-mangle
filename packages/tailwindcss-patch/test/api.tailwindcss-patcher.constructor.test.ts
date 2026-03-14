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
      tailwindcss: {
        version: 3,
        packageName: 'tailwindcss-missing',
      },
    })).toThrow('Unable to locate Tailwind CSS package')
  })

  it('infers the version from the resolved package when tailwindcss.version is omitted', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('3.4.19'))
    const patcher = new TailwindcssPatcher({
      cache: false,
      extract: {
        write: false,
      },
      tailwindcss: {} as any,
    })

    expect(patcher.majorVersion).toBe(3)
  })

  it('requires an explicit tailwindcss.version when the resolved package version is not inferable', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('canary'))
    expect(() => new TailwindcssPatcher({
      cache: false,
      extract: {
        write: false,
      },
      tailwindcss: {} as any,
    })).toThrow('Unable to infer Tailwind CSS major version')
  })

  it('uses the explicit version hint when the installed package version is not semver', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('canary'))
    const patcher = new TailwindcssPatcher({
      cache: false,
      extract: {
        write: false,
      },
      tailwindcss: {
        version: 2,
      },
    })
    expect(patcher.majorVersion).toBe(2)
  })

  it('throws when the configured version does not match the resolved package version', async () => {
    const { TailwindcssPatcher } = await importPatcherWithPackageResolver(() => createPkgInfo('5.0.1'))
    expect(() => new TailwindcssPatcher({
      cache: false,
      extract: {
        write: false,
      },
      tailwindcss: {
        version: 2,
      },
    })).toThrow('Configured tailwindcss.version=2')
  })
})

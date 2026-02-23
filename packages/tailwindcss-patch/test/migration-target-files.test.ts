import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectWorkspaceConfigFiles,
  filterTargetFiles,
  resolveBackupRelativePath,
  resolveTargetFiles,
} from '../src/commands/migration-target-files'

const tempDirs: string[] = []

async function createTempDir(prefix: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => fs.remove(dir)))
})

describe('migration target files', () => {
  it('resolves target files with dedupe', () => {
    const cwd = '/repo'
    const files = resolveTargetFiles(cwd, ['a.ts', 'a.ts', 'b.ts'])

    expect(files).toEqual([
      '/repo/a.ts',
      '/repo/b.ts',
    ])
  })

  it('collects workspace config files and respects ignored directories and max depth', async () => {
    const cwd = await createTempDir('tw-patch-targets-')
    await fs.ensureDir(path.join(cwd, 'packages/a'))
    await fs.ensureDir(path.join(cwd, 'node_modules/ignored'))
    await fs.ensureDir(path.join(cwd, 'packages/deep/inner'))

    await fs.writeFile(path.join(cwd, 'tailwindcss-patch.config.ts'), 'export default {}', 'utf8')
    await fs.writeFile(path.join(cwd, 'packages/a/tailwindcss-patch.config.ts'), 'export default {}', 'utf8')
    await fs.writeFile(path.join(cwd, 'node_modules/ignored/tailwindcss-patch.config.ts'), 'export default {}', 'utf8')
    await fs.writeFile(path.join(cwd, 'packages/deep/inner/tailwindcss-patch.config.ts'), 'export default {}', 'utf8')

    const shallow = await collectWorkspaceConfigFiles(cwd, 1)
    const deep = await collectWorkspaceConfigFiles(cwd, 4)

    expect(shallow).toEqual([
      path.join(cwd, 'tailwindcss-patch.config.ts'),
    ])
    expect(deep).toContain(path.join(cwd, 'packages/a/tailwindcss-patch.config.ts'))
    expect(deep).toContain(path.join(cwd, 'packages/deep/inner/tailwindcss-patch.config.ts'))
    expect(deep).not.toContain(path.join(cwd, 'node_modules/ignored/tailwindcss-patch.config.ts'))
  })

  it('filters target files by include and exclude patterns', () => {
    const cwd = '/repo'
    const files = [
      '/repo/packages/a/tailwindcss-patch.config.ts',
      '/repo/packages/skip/tailwindcss-patch.config.ts',
      '/repo/apps/a/tailwindcss-patch.config.ts',
    ]

    const filtered = filterTargetFiles(
      files,
      cwd,
      ['packages/**'],
      ['packages/skip/**'],
    )

    expect(filtered).toEqual([
      '/repo/packages/a/tailwindcss-patch.config.ts',
    ])
  })

  it('builds backup-relative paths for internal and external files', () => {
    const internal = resolveBackupRelativePath('/repo', '/repo/packages/a.ts')
    const external = resolveBackupRelativePath('/repo', '/tmp/a.ts')

    expect(internal).toBe('packages/a.ts.bak')
    expect(external.startsWith('__external__')).toBe(true)
    expect(external.endsWith('.bak')).toBe(true)
  })
})

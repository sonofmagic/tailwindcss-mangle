import os from 'node:os'

import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { resolveMigrationTargetFiles } from '../src/commands/migration-target-resolver'

describe('migration target resolver', () => {
  it('resolves explicit target files as absolute paths', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-target-resolver-files-'))
    try {
      const result = await resolveMigrationTargetFiles({
        cwd,
        files: ['tailwindcss-patch.config.ts', './tailwindcss-patch.config.ts'],
      })

      expect(result).toEqual([path.resolve(cwd, 'tailwindcss-patch.config.ts')])
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('respects workspace mode and maxDepth', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-target-resolver-workspace-'))
    const shallow = path.resolve(cwd, 'apps/a/tailwindcss-patch.config.ts')
    const deep = path.resolve(cwd, 'apps/b/deep/tailwindcss-patch.config.ts')
    try {
      await fs.outputFile(shallow, 'export default {}\n', 'utf8')
      await fs.outputFile(deep, 'export default {}\n', 'utf8')

      const result = await resolveMigrationTargetFiles({
        cwd,
        workspace: true,
        maxDepth: 2,
      })

      expect(result).toEqual([shallow])
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('applies include and exclude filters to discovered workspace files', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-target-resolver-filter-'))
    const appConfig = path.resolve(cwd, 'apps/a/tailwindcss-mangle.config.ts')
    const pkgConfig = path.resolve(cwd, 'packages/b/tailwindcss-patch.config.ts')
    try {
      await fs.outputFile(appConfig, 'export default {}\n', 'utf8')
      await fs.outputFile(pkgConfig, 'export default {}\n', 'utf8')

      const result = await resolveMigrationTargetFiles({
        cwd,
        workspace: true,
        include: ['apps/**', 'packages/**'],
        exclude: ['packages/**'],
      })

      expect(result).toEqual([appConfig])
    }
    finally {
      await fs.remove(cwd)
    }
  })
})

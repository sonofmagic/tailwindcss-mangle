import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import { migrateConfigFiles, migrateConfigSource, restoreConfigFiles } from '../src/cli/migrate-config'

describe('migrateConfigSource', () => {
  it('migrates registry legacy keys to modern shape', () => {
    const source = `import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  registry: {
    output: {
      file: '.tw-patch/classes.json',
      stripUniversalSelector: false,
    },
    tailwind: {
      package: 'tailwindcss',
      classic: {
        cwd: './apps/demo',
      },
    },
  },
})
`
    const result = migrateConfigSource(source)
    expect(result.changed).toBe(true)
    expect(result.code).toContain('extract')
    expect(result.code).toContain('removeUniversalSelector')
    expect(result.code).toContain('tailwindcss')
    expect(result.code).toContain('packageName')
    expect(result.code).toContain('v3')
    expect(result.code).not.toContain('output:')
    expect(result.code).not.toContain('tailwind:')
    expect(result.code).not.toContain('classic:')
    expect(result.code).not.toContain('stripUniversalSelector')
  })

  it('migrates root legacy keys and keeps modern keys preferred when both exist', () => {
    const source = `import { defineConfig } from 'tailwindcss-patch'

export default defineConfig({
  cwd: '.',
  projectRoot: './modern-root',
  overwrite: false,
  features: {
    exportContext: true,
  },
  apply: {
    overwrite: true,
  },
  output: {
    enabled: false,
  },
  extract: {
    file: '.tw-patch/classes-modern.json',
  },
})
`
    const result = migrateConfigSource(source)
    expect(result.changed).toBe(true)
    expect(result.code).toContain('projectRoot: \'./modern-root\'')
    expect(result.code).toContain('apply')
    expect(result.code).toContain('exposeContext')
    expect(result.code).toContain('overwrite: true')
    expect(result.code).toContain('extract')
    expect(result.code).toContain('write: false')
    expect(result.code).not.toContain('\ncwd:')
    expect(result.code).not.toContain('\noverwrite:')
    expect(result.code).not.toContain('\nfeatures:')
    expect(result.code).not.toContain('\noutput:')
  })

  it('supports export-default identifier forms', () => {
    const source = `import { defineConfig } from 'tailwindcss-patch'

const config = defineConfig({
  registry: {
    output: {
      file: '.tw-patch/classes.json',
    },
  },
})

export default config
`
    const result = migrateConfigSource(source)
    expect(result.changed).toBe(true)
    expect(result.code).toContain('extract')
    expect(result.code).not.toContain('output:')
  })
})

describe('migrateConfigFiles', () => {
  it('supports dry-run mode without writing files', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-dry-run-'))
    const file = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    try {
      await fs.writeFile(file, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')
      const report = await migrateConfigFiles({
        cwd,
        dryRun: true,
      })

      expect(report.reportKind).toBe('tw-patch-migrate-report')
      expect(report.schemaVersion).toBe(1)
      expect(report.generatedAt).toBeTypeOf('string')
      expect(report.tool.name).toBe('tailwindcss-patch')
      expect(report.scannedFiles).toBe(1)
      expect(report.changedFiles).toBe(1)
      expect(report.writtenFiles).toBe(0)
      expect(report.backupsWritten).toBe(0)
      expect(report.rollbackOnError).toBe(true)
      const after = await fs.readFile(file, 'utf8')
      expect(after).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('writes migrated file content and supports explicit file targeting', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-write-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const untouched = path.resolve(cwd, 'tailwindcss-mangle.config.ts')
    try {
      await fs.writeFile(target, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')
      await fs.writeFile(untouched, `export default { registry: { output: { file: 'y.json' } } }\n`, 'utf8')

      const report = await migrateConfigFiles({
        cwd,
        files: ['tailwindcss-patch.config.ts'],
        backupDir: '.tw-patch/migrate-backups',
      })

      expect(report.scannedFiles).toBe(1)
      expect(report.changedFiles).toBe(1)
      expect(report.writtenFiles).toBe(1)
      expect(report.backupsWritten).toBe(1)
      expect(report.missingFiles).toBe(0)
      expect(report.backupDirectory).toBe(path.resolve(cwd, '.tw-patch/migrate-backups'))

      const migrated = await fs.readFile(target, 'utf8')
      expect(migrated).toContain('extract')
      expect(migrated).not.toContain('output')
      const backupFile = path.resolve(cwd, '.tw-patch/migrate-backups/tailwindcss-patch.config.ts.bak')
      const backupContent = await fs.readFile(backupFile, 'utf8')
      expect(backupContent).toContain('output')
      expect(backupContent).not.toContain('extract')

      const untouchedContent = await fs.readFile(untouched, 'utf8')
      expect(untouchedContent).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('scans workspace config files recursively when workspace mode is enabled', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-workspace-'))
    const appConfig = path.resolve(cwd, 'apps/demo-a/tailwindcss-mangle.config.ts')
    const packageConfig = path.resolve(cwd, 'packages/demo-b/tailwindcss-patch.config.ts')
    const ignoredConfig = path.resolve(cwd, 'node_modules/demo/tailwindcss-patch.config.ts')
    try {
      await fs.outputFile(appConfig, `export default { registry: { output: { file: 'a.json' } } }\n`, 'utf8')
      await fs.outputFile(packageConfig, `export default { registry: { output: { file: 'b.json' } } }\n`, 'utf8')
      await fs.outputFile(ignoredConfig, `export default { registry: { output: { file: 'c.json' } } }\n`, 'utf8')

      const report = await migrateConfigFiles({
        cwd,
        workspace: true,
      })

      expect(report.scannedFiles).toBe(2)
      expect(report.changedFiles).toBe(2)
      expect(report.writtenFiles).toBe(2)
      expect(report.backupsWritten).toBe(0)
      expect(report.missingFiles).toBe(0)

      const appResult = await fs.readFile(appConfig, 'utf8')
      const packageResult = await fs.readFile(packageConfig, 'utf8')
      const ignoredResult = await fs.readFile(ignoredConfig, 'utf8')
      expect(appResult).toContain('extract')
      expect(packageResult).toContain('extract')
      expect(ignoredResult).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('respects workspace max depth', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-depth-'))
    const deepConfig = path.resolve(cwd, 'apps/demo-a/sub/tailwindcss-mangle.config.ts')
    try {
      await fs.outputFile(deepConfig, `export default { registry: { output: { file: 'deep.json' } } }\n`, 'utf8')

      const report = await migrateConfigFiles({
        cwd,
        workspace: true,
        maxDepth: 1,
      })

      expect(report.scannedFiles).toBe(0)
      expect(report.changedFiles).toBe(0)
      expect(report.writtenFiles).toBe(0)
      expect(report.backupsWritten).toBe(0)

      const result = await fs.readFile(deepConfig, 'utf8')
      expect(result).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('filters workspace files by include/exclude glob patterns', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-filter-'))
    const appConfig = path.resolve(cwd, 'apps/demo-a/tailwindcss-mangle.config.ts')
    const packageConfig = path.resolve(cwd, 'packages/demo-b/tailwindcss-patch.config.ts')
    try {
      await fs.outputFile(appConfig, `export default { registry: { output: { file: 'app.json' } } }\n`, 'utf8')
      await fs.outputFile(packageConfig, `export default { registry: { output: { file: 'pkg.json' } } }\n`, 'utf8')

      const report = await migrateConfigFiles({
        cwd,
        workspace: true,
        include: ['apps/**'],
        exclude: ['**/demo-b/**'],
      })

      expect(report.scannedFiles).toBe(1)
      expect(report.changedFiles).toBe(1)
      expect(report.writtenFiles).toBe(1)

      const appAfter = await fs.readFile(appConfig, 'utf8')
      const packageAfter = await fs.readFile(packageConfig, 'utf8')
      expect(appAfter).toContain('extract')
      expect(packageAfter).toContain('output')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('rolls back already written files when a later write fails', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-migrate-rollback-'))
    const first = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const second = path.resolve(cwd, 'tailwindcss-mangle.config.ts')
    try {
      await fs.writeFile(first, `export default { registry: { output: { file: 'first.json' } } }\n`, 'utf8')
      await fs.writeFile(second, `export default { registry: { output: { file: 'second.json' } } }\n`, 'utf8')

      const originalWriteFile = fs.writeFile.bind(fs)
      let migrationWriteCount = 0
      const writeSpy = vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
        const [target] = args
        const filePath = String(target)
        if (filePath === first || filePath === second) {
          migrationWriteCount += 1
          if (migrationWriteCount === 2) {
            throw new Error('simulated write failure')
          }
        }
        return originalWriteFile(...args)
      })

      await expect(migrateConfigFiles({
        cwd,
        files: ['tailwindcss-patch.config.ts', 'tailwindcss-mangle.config.ts'],
      })).rejects.toThrow('Failed to write migrated config')

      writeSpy.mockRestore()

      const firstAfter = await fs.readFile(first, 'utf8')
      const secondAfter = await fs.readFile(second, 'utf8')
      expect(firstAfter).toContain('output')
      expect(firstAfter).not.toContain('extract')
      expect(secondAfter).toContain('output')
      expect(secondAfter).not.toContain('extract')
    }
    finally {
      vi.restoreAllMocks()
      await fs.remove(cwd)
    }
  })
})

describe('restoreConfigFiles', () => {
  it('restores config files from migration report backups', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const backup = path.resolve(cwd, '.tw-patch/migrate-backups/tailwindcss-patch.config.ts.bak')
    const reportPath = path.resolve(cwd, '.tw-patch/migrate-report.json')
    try {
      await fs.outputFile(target, `export default { registry: { extract: { file: 'x.json' } } }\n`, 'utf8')
      await fs.outputFile(backup, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')
      await fs.outputJSON(reportPath, {
        entries: [{ file: target, backupFile: backup }],
      }, { spaces: 2 })

      const result = await restoreConfigFiles({
        cwd,
        reportFile: '.tw-patch/migrate-report.json',
      })

      expect(result.reportSchemaVersion).toBeUndefined()
      expect(result.restoredFiles).toBe(1)
      expect(result.missingBackups).toBe(0)
      const restored = await fs.readFile(target, 'utf8')
      expect(restored).toContain('output')
      expect(restored).not.toContain('extract')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('supports dry-run restore without writing files', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-dry-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const backup = path.resolve(cwd, '.tw-patch/migrate-backups/tailwindcss-patch.config.ts.bak')
    const reportPath = path.resolve(cwd, '.tw-patch/migrate-report.json')
    try {
      const targetContent = `export default { registry: { extract: { file: 'x.json' } } }\n`
      await fs.outputFile(target, targetContent, 'utf8')
      await fs.outputFile(backup, `export default { registry: { output: { file: 'x.json' } } }\n`, 'utf8')
      await fs.outputJSON(reportPath, {
        entries: [{ file: target, backupFile: backup }],
      }, { spaces: 2 })

      const result = await restoreConfigFiles({
        cwd,
        reportFile: '.tw-patch/migrate-report.json',
        dryRun: true,
      })

      expect(result.restoredFiles).toBe(1)
      const after = await fs.readFile(target, 'utf8')
      expect(after).toBe(targetContent)
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('throws in strict mode when backup files are missing', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-strict-'))
    const target = path.resolve(cwd, 'tailwindcss-patch.config.ts')
    const backup = path.resolve(cwd, '.tw-patch/migrate-backups/tailwindcss-patch.config.ts.bak')
    const reportPath = path.resolve(cwd, '.tw-patch/migrate-report.json')
    try {
      await fs.outputFile(target, `export default { registry: { extract: { file: 'x.json' } } }\n`, 'utf8')
      await fs.outputJSON(reportPath, {
        entries: [{ file: target, backupFile: backup }],
      }, { spaces: 2 })

      await expect(restoreConfigFiles({
        cwd,
        reportFile: '.tw-patch/migrate-report.json',
        strict: true,
      })).rejects.toThrow('Restore failed')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('throws on unsupported report schema versions', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-schema-'))
    const reportPath = path.resolve(cwd, '.tw-patch/migrate-report.json')
    try {
      await fs.outputJSON(reportPath, {
        reportKind: 'tw-patch-migrate-report',
        schemaVersion: 999,
        entries: [],
      }, { spaces: 2 })

      await expect(restoreConfigFiles({
        cwd,
        reportFile: '.tw-patch/migrate-report.json',
      })).rejects.toThrow('Unsupported report schema version')
    }
    finally {
      await fs.remove(cwd)
    }
  })

  it('throws on unsupported report kind', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-restore-kind-'))
    const reportPath = path.resolve(cwd, '.tw-patch/migrate-report.json')
    try {
      await fs.outputJSON(reportPath, {
        reportKind: 'unknown-report',
        entries: [],
      }, { spaces: 2 })

      await expect(restoreConfigFiles({
        cwd,
        reportFile: '.tw-patch/migrate-report.json',
      })).rejects.toThrow('Unsupported report kind')
    }
    finally {
      await fs.remove(cwd)
    }
  })
})

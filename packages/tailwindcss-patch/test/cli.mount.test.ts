import cac from 'cac'
import fs from 'fs-extra'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TailwindcssPatcher } from '../src/api/tailwindcss-patcher'
import { mountTailwindcssPatchCommands } from '../src/cli/commands'
import logger from '../src/logger'

const patcherInstances: any[] = []
const { migrateConfigFilesMock } = vi.hoisted(() => {
  return {
    migrateConfigFilesMock: vi.fn(async () => ({
      cwd: '/tmp/project',
      dryRun: false,
      rollbackOnError: true,
      scannedFiles: 1,
      changedFiles: 1,
      writtenFiles: 1,
      backupsWritten: 0,
      unchangedFiles: 0,
      missingFiles: 0,
      entries: [
        {
          file: '/tmp/project/tailwindcss-patch.config.ts',
          changed: true,
          written: true,
          rolledBack: false,
          changes: ['registry.output -> registry.extract'],
        },
      ],
    })),
  }
})

vi.mock('@tailwindcss-mangle/config', () => {
  return {
    CONFIG_NAME: 'tailwindcss-patch',
    getConfig: vi.fn(async () => ({ config: {} })),
    initConfig: vi.fn(async () => {}),
  }
})

vi.mock('../src/api/tailwindcss-patcher', () => {
  const tokenReport = {
    entries: [
      {
        rawCandidate: 'text-blue-500',
        file: '/tmp/project/src/button.tsx',
        relativeFile: 'src/button.tsx',
        extension: '.tsx',
        start: 0,
        end: 13,
        length: 13,
        line: 1,
        column: 1,
        lineText: 'text-blue-500',
      },
    ],
    filesScanned: 1,
    skippedFiles: [],
    sources: [],
  }

  const patchReport = {
    package: {
      name: 'tailwindcss',
      version: '3.4.0',
      root: '/tmp/project',
    },
    majorVersion: 3,
    entries: [],
  }

  function createTailwindcssPatcherMock() {
    const instance = {
      patch: vi.fn(),
      extract: vi.fn().mockResolvedValue({ classList: ['foo'], filename: '.tw-patch/classes.json' }),
      collectContentTokens: vi.fn().mockResolvedValue(tokenReport),
      getPatchStatus: vi.fn().mockResolvedValue(patchReport),
    }
    patcherInstances.push(instance)
    return instance
  }

  const TailwindcssPatcher = vi.fn().mockImplementation(createTailwindcssPatcherMock)

  return {
    TailwindcssPatcher,
  }
})

vi.mock('../src/logger', () => {
  const logger = {
    success: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    info: vi.fn(),
  }
  return {
    default: logger,
  }
})

vi.mock('../src/cli/migrate-config', () => {
  return {
    migrateConfigFiles: migrateConfigFilesMock,
  }
})

describe('mountTailwindcssPatchCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    patcherInstances.length = 0
  })

  it('registers commands on an existing cac instance', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'install', '--cwd', '/tmp/project'], { run: false })
    await cli.runMatchedCommand()

    expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
    expect(patcherInstances[0].patch).toHaveBeenCalledTimes(1)
  })

  it('supports prefixed commands when mounting', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, { commandPrefix: 'tw:' })

    cli.parse(['node', 'embedded', 'tw:tokens', '--no-write'], { run: false })
    await cli.runMatchedCommand()

    expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
    expect(patcherInstances[0].collectContentTokens).toHaveBeenCalledTimes(1)
  })

  it('allows selecting specific commands to mount', () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, { commands: ['tokens'] })

    const commandNames = cli.commands.map(command => command.name)
    expect(commandNames).toContain('tokens')
    expect(commandNames).not.toContain('install')
    expect(commandNames).not.toContain('extract')
    expect(commandNames).not.toContain('init')
  })

  it('runs the status command and can emit JSON', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'status', '--json'], { run: false })
    await cli.runMatchedCommand()

    expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
    expect(patcherInstances[0].getPatchStatus).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledWith(JSON.stringify({
      package: {
        name: 'tailwindcss',
        version: '3.4.0',
        root: '/tmp/project',
      },
      majorVersion: 3,
      entries: [],
    }, null, 2))
  })

  it('supports custom command names and aliases', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, {
      commandOptions: {
        install: { name: 'patch-install', aliases: ['i'] },
      },
    })

    cli.parse(['node', 'embedded', 'patch-install'], { run: false })
    await cli.runMatchedCommand()
    expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
    expect(patcherInstances[0].patch).toHaveBeenCalledTimes(1)

    cli.unsetMatchedCommand()
    cli.parse(['node', 'embedded', 'i'], { run: false })
    await cli.runMatchedCommand()
    expect(TailwindcssPatcher).toHaveBeenCalledTimes(2)
    expect(patcherInstances[1].patch).toHaveBeenCalledTimes(1)
  })

  it('invokes custom command handlers with structured context', async () => {
    const handler = vi.fn(async (ctx, next) => {
      expect(ctx.commandName).toBe('extract')
      expect(ctx.cwd).toBe(path.resolve('./tmp/project'))
      await ctx.loadConfig()
      const patcher = await ctx.createPatcher()
      expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
      const result = await next()
      expect(result.classList).toEqual(['foo'])
      expect(patcher.extract).toHaveBeenCalledTimes(1)
      return result
    })

    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, {
      commandHandlers: {
        extract: handler,
      },
    })

    cli.parse(['node', 'embedded', 'extract', '--cwd', './tmp/project'], { run: false })
    await cli.runMatchedCommand()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(TailwindcssPatcher).toHaveBeenCalledTimes(1)
    expect(patcherInstances[0].extract).toHaveBeenCalledTimes(1)
  })

  it('allows command handlers to replace default actions entirely', async () => {
    const handler = vi.fn(async (ctx) => {
      const patcher = await ctx.createPatcher()
      await patcher.patch()
      ctx.logger.success('custom handler finished')
    })

    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, {
      commandHandlers: {
        install: handler,
      },
    })

    cli.parse(['node', 'embedded', 'install'], { run: false })
    await cli.runMatchedCommand()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(logger.success).toHaveBeenCalledTimes(1)
    expect(logger.success).toHaveBeenCalledWith('custom handler finished')
  })

  it('supports overriding command descriptions and option definitions', () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli, {
      commandOptions: {
        tokens: {
          description: 'Custom tokens description',
          appendDefaultOptions: false,
          optionDefs: [{ flags: '--preview', description: 'Preview tokens' }],
        },
      },
    })

    const tokensCommand = cli.commands.find(command => command.name === 'tokens')
    expect(tokensCommand?.description).toBe('Custom tokens description')
    expect(tokensCommand?.options).toHaveLength(1)
    expect(tokensCommand?.options?.[0].rawName).toBe('--preview')
  })

  it('runs migrate command with dry-run and custom config path', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--dry-run', '--config', 'custom.config.ts'], { run: false })
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(migrateConfigFilesMock).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      dryRun: true,
      files: ['custom.config.ts'],
    })
  })

  it('passes workspace migration options to migrate runner', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--workspace', '--max-depth', '3'], { run: false })
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(migrateConfigFilesMock).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      dryRun: false,
      workspace: true,
      maxDepth: 3,
    })
  })

  it('fails in migrate check mode when changes are required', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--check'], { run: false })
    await expect(cli.runMatchedCommand()).rejects.toThrow('Migration check failed')

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(migrateConfigFilesMock).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      dryRun: true,
    })
  })

  it('passes migrate check mode when no changes are required', async () => {
    migrateConfigFilesMock.mockResolvedValueOnce({
      cwd: '/tmp/project',
      dryRun: true,
      rollbackOnError: true,
      scannedFiles: 1,
      changedFiles: 0,
      writtenFiles: 0,
      backupsWritten: 0,
      unchangedFiles: 1,
      missingFiles: 0,
      entries: [
        {
          file: '/tmp/project/tailwindcss-patch.config.ts',
          changed: false,
          written: false,
          rolledBack: false,
          changes: [],
        },
      ],
    })

    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--check'], { run: false })
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration summary'))
  })

  it('prints migrate report in JSON mode', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--json'], { run: false })
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledWith(JSON.stringify({
      cwd: '/tmp/project',
      dryRun: false,
      rollbackOnError: true,
      scannedFiles: 1,
      changedFiles: 1,
      writtenFiles: 1,
      backupsWritten: 0,
      unchangedFiles: 0,
      missingFiles: 0,
      entries: [
        {
          file: '/tmp/project/tailwindcss-patch.config.ts',
          changed: true,
          written: true,
          rolledBack: false,
          changes: ['registry.output -> registry.extract'],
        },
      ],
    }, null, 2))
  })

  it('passes backup directory to migrate runner', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--backup-dir', '.tw-patch/migrate-backups'], { run: false })
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(migrateConfigFilesMock).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      dryRun: false,
      backupDir: '.tw-patch/migrate-backups',
    })
  })

  it('passes include and exclude patterns to migrate runner', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    cli.parse(
      ['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--include', 'apps/**', '--include', 'packages/**', '--exclude', '**/legacy/**'],
      { run: false },
    )
    await cli.runMatchedCommand()

    expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
    expect(migrateConfigFilesMock).toHaveBeenCalledWith({
      cwd: '/tmp/project',
      dryRun: false,
      include: ['apps/**', 'packages/**'],
      exclude: ['**/legacy/**'],
    })
  })

  it('writes migrate report to report file when requested', async () => {
    const cli = cac('embedded')
    mountTailwindcssPatchCommands(cli)

    const writeJSONSpy = vi.spyOn(fs, 'writeJSON').mockResolvedValue(undefined)
    try {
      cli.parse(['node', 'embedded', 'migrate', '--cwd', '/tmp/project', '--report-file', '.tw-patch/migrate-report.json'], { run: false })
      await cli.runMatchedCommand()
      expect(migrateConfigFilesMock).toHaveBeenCalledTimes(1)
      expect(writeJSONSpy).toHaveBeenCalledTimes(1)
      expect(writeJSONSpy).toHaveBeenCalledWith(
        path.resolve('/tmp/project', '.tw-patch/migrate-report.json'),
        expect.objectContaining({
          cwd: '/tmp/project',
          changedFiles: 1,
        }),
        { spaces: 2 },
      )
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Migration report written'))
    }
    finally {
      writeJSONSpy.mockRestore()
    }
  })
})

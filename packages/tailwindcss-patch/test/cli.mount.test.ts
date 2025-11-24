import cac from 'cac'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const patcherInstances: any[] = []

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

  return {
    TailwindcssPatcher: vi.fn(function TailwindcssPatcherMock() {
      const instance = {
        patch: vi.fn(),
        extract: vi.fn().mockResolvedValue({ classList: ['foo'], filename: '.tw-patch/classes.json' }),
        collectContentTokens: vi.fn().mockResolvedValue(tokenReport),
      }
      patcherInstances.push(instance)
      return instance
    }),
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

import { mountTailwindcssPatchCommands } from '../src/cli/commands'
import { TailwindcssPatcher } from '../src/api/tailwindcss-patcher'

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
})

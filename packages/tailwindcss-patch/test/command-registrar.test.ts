import { describe, expect, it, vi } from 'vitest'
import { registerTailwindcssPatchCommand } from '../src/commands/command-registrar'

const {
  applyCommandOptionsMock,
  resolveCommandMetadataMock,
  runWithCommandHandlerMock,
  installDefaultHandlerMock,
} = vi.hoisted(() => ({
  applyCommandOptionsMock: vi.fn(),
  resolveCommandMetadataMock: vi.fn(),
  runWithCommandHandlerMock: vi.fn(),
  installDefaultHandlerMock: vi.fn(),
}))

vi.mock('../src/commands/metadata', () => {
  return {
    applyCommandOptions: applyCommandOptionsMock,
    resolveCommandMetadata: resolveCommandMetadataMock,
  }
})

vi.mock('../src/commands/command-runtime', () => {
  return {
    runWithCommandHandler: runWithCommandHandlerMock,
  }
})

vi.mock('../src/commands/default-handler-map', () => {
  return {
    defaultCommandHandlers: {
      install: installDefaultHandlerMock,
    },
  }
})

describe('command registrar', () => {
  it('registers command metadata, aliases and forwards action to runtime pipeline', async () => {
    let actionHandler: ((args: any) => Promise<any>) | undefined
    const command = {
      action: vi.fn((handler: (args: any) => Promise<any>) => {
        actionHandler = handler
      }),
      alias: vi.fn(),
    }
    const cli = {
      command: vi.fn(() => command),
    }
    const customHandler = vi.fn()
    const options = {
      commandHandlers: {
        install: customHandler,
      },
    }

    resolveCommandMetadataMock.mockReturnValue({
      name: 'install',
      description: 'Install patches',
      optionDefs: [{ flags: '--cwd <dir>' }],
      aliases: ['i'],
    })
    runWithCommandHandlerMock.mockResolvedValue({ ok: true })

    registerTailwindcssPatchCommand(
      cli as any,
      'install',
      options as any,
      '',
      {} as any,
    )

    expect(resolveCommandMetadataMock).toHaveBeenCalledWith('install', options, '', {})
    expect(cli.command).toHaveBeenCalledWith('install', 'Install patches')
    expect(applyCommandOptionsMock).toHaveBeenCalledWith(command, [{ flags: '--cwd <dir>' }])
    expect(command.alias).toHaveBeenCalledWith('i')
    expect(actionHandler).toBeTypeOf('function')

    const args = { cwd: '/tmp/project' }
    const result = await actionHandler?.(args)

    expect(runWithCommandHandlerMock).toHaveBeenCalledWith(
      cli,
      command,
      'install',
      args,
      customHandler,
      installDefaultHandlerMock,
    )
    expect(result).toEqual({ ok: true })
  })
})

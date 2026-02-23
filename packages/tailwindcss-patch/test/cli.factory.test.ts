import { describe, expect, it } from 'vitest'
import { createTailwindcssPatchCli } from '../src/commands/cli'

describe('cli factory', () => {
  it('creates cli with default name and mounts default commands', () => {
    const cli = createTailwindcssPatchCli()
    const commandNames = cli.commands.map(command => command.name)

    expect(cli.name).toBe('tw-patch')
    expect(commandNames).toContain('install')
    expect(commandNames).toContain('tokens')
    expect(commandNames).toContain('status')
  })

  it('creates cli with custom name and selected command mounts', () => {
    const cli = createTailwindcssPatchCli({
      name: 'embedded',
      mountOptions: {
        commands: ['status'],
      },
    })
    const commandNames = cli.commands.map(command => command.name)

    expect(cli.name).toBe('embedded')
    expect(commandNames).toContain('status')
    expect(commandNames).not.toContain('install')
    expect(commandNames).not.toContain('extract')
  })
})

import { describe, expect, it, vi } from 'vitest'
import { buildDefaultCommandDefinitions } from '../src/commands/command-definitions'
import { applyCommandOptions, resolveCommandMetadata } from '../src/commands/command-metadata'

describe('command metadata', () => {
  it('resolves prefixed command names and aliases without duplicating the prefix', () => {
    const metadata = resolveCommandMetadata(
      'install',
      {
        commandOptions: {
          install: {
            name: 'tw:patch-install',
            aliases: ['i', 'tw:install'],
          },
        },
      },
      'tw:',
      buildDefaultCommandDefinitions(),
    )

    expect(metadata.name).toBe('tw:patch-install')
    expect(metadata.aliases).toEqual(['tw:i', 'tw:install'])
  })

  it('replaces default options when appendDefaultOptions is disabled', () => {
    const customOption = { flags: '--force', description: 'Force patching' }
    const metadata = resolveCommandMetadata(
      'install',
      {
        commandOptions: {
          install: {
            appendDefaultOptions: false,
            optionDefs: [customOption],
          },
        },
      },
      '',
      buildDefaultCommandDefinitions(),
    )

    expect(metadata.optionDefs).toEqual([customOption])
  })

  it('appends custom options by default when appendDefaultOptions is not set', () => {
    const customOption = { flags: '--force', description: 'Force patching' }
    const metadata = resolveCommandMetadata(
      'install',
      {
        commandOptions: {
          install: {
            optionDefs: [customOption],
          },
        },
      },
      '',
      buildDefaultCommandDefinitions(),
    )

    expect(metadata.optionDefs[0]).toMatchObject({ flags: '--cwd <dir>' })
    expect(metadata.optionDefs.at(-1)).toEqual(customOption)
  })

  it('applies option definitions to cac command objects', () => {
    const option = vi.fn()
    const command = { option } as any
    const optionDefs = [
      { flags: '--cwd <dir>', description: 'Working directory', config: { default: '/tmp/project' } },
      { flags: '--json', description: 'Print JSON' },
    ]

    applyCommandOptions(command, optionDefs)

    expect(option).toHaveBeenNthCalledWith(1, '--cwd <dir>', 'Working directory', { default: '/tmp/project' })
    expect(option).toHaveBeenNthCalledWith(2, '--json', 'Print JSON', undefined)
  })
})

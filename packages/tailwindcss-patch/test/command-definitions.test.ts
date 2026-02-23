import { describe, expect, it } from 'vitest'
import { buildDefaultCommandDefinitions } from '../src/commands/command-definitions'
import { DEFAULT_TOKEN_REPORT } from '../src/commands/token-output'
import { tailwindcssPatchCommands } from '../src/commands/types'

describe('command definitions', () => {
  it('builds default definitions for every supported command', () => {
    const definitions = buildDefaultCommandDefinitions()

    expect(Object.keys(definitions).sort()).toEqual([...tailwindcssPatchCommands].sort())
    for (const command of tailwindcssPatchCommands) {
      expect(definitions[command].description.length).toBeGreaterThan(0)
      expect(definitions[command].optionDefs.length).toBeGreaterThan(0)
    }
  })

  it('includes cwd option defaults for all commands', () => {
    const definitions = buildDefaultCommandDefinitions()

    for (const command of tailwindcssPatchCommands) {
      const cwdOption = definitions[command].optionDefs[0]
      expect(cwdOption.flags).toBe('--cwd <dir>')
      expect(cwdOption.config?.default).toBe(process.cwd())
    }
  })

  it('keeps command specific option defaults intact', () => {
    const definitions = buildDefaultCommandDefinitions()

    expect(definitions.tokens.optionDefs.find(option => option.flags === '--output <file>')?.config).toEqual({
      default: DEFAULT_TOKEN_REPORT,
    })
    expect(definitions.tokens.optionDefs.find(option => option.flags === '--format <format>')?.config).toEqual({
      default: 'json',
    })
    expect(definitions.tokens.optionDefs.find(option => option.flags === '--group-key <key>')?.config).toEqual({
      default: 'relative',
    })
    expect(definitions.migrate.optionDefs.find(option => option.flags === '--max-depth <n>')?.config).toEqual({
      default: 6,
    })
  })
})

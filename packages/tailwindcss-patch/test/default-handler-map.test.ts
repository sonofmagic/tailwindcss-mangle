import { describe, expect, it } from 'vitest'
import { defaultCommandHandlers } from '../src/commands/default-handler-map'
import { tailwindcssPatchCommands } from '../src/commands/types'

describe('default command handler map', () => {
  it('provides handlers for all supported commands', () => {
    const handlerCommands = Object.keys(defaultCommandHandlers).sort()
    const supportedCommands = [...tailwindcssPatchCommands].sort()
    expect(handlerCommands).toEqual(supportedCommands)
  })
})

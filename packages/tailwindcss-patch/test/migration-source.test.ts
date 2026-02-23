import { describe, expect, it } from 'vitest'
import { migrateConfigSource } from '../src/commands/migration-source'

describe('migration source', () => {
  it('returns unchanged when no export default object can be resolved', () => {
    const source = `
const config = 123
export default config
`.trim()

    const result = migrateConfigSource(source)
    expect(result).toEqual({
      changed: false,
      code: source,
      changes: [],
    })
  })

  it('returns unchanged when config has no legacy fields', () => {
    const source = `
export default {
  apply: {
    exposeContext: true,
  },
}
`.trim()

    const result = migrateConfigSource(source)
    expect(result).toEqual({
      changed: false,
      code: source,
      changes: [],
    })
  })

  it('migrates legacy fields under patch options', () => {
    const source = `
export default {
  patch: {
    output: {
      enabled: true,
    },
  },
}
`.trim()

    const result = migrateConfigSource(source)
    expect(result.changed).toBe(true)
    expect(result.changes).toContain('patch.output -> patch.extract')
    expect(result.changes).toContain('patch.enabled -> patch.write')
    expect(result.code).toContain('extract')
    expect(result.code).toContain('write')
  })
})

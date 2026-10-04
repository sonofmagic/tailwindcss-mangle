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

  it('preserves TypeScript wrappers, computed string keys and comments', () => {
    const source = `// config header
const config = defineConfig(({
  // compatibility switches
  registry: {
    /* extraction note */ ['output']: {
      enabled: getEnabled(), /* file note */
      file: \`classes-\${name}.json\`,
    },
  }, // registry end
} satisfies Config) as Config)
export default config
// footer
`
    const result = migrateConfigSource(source)
    expect(result.changed).toBe(true)
    expect(result.changes).toEqual(['registry.output -> registry.extract', 'registry.enabled -> registry.write'])
    for (const comment of ['config header', 'compatibility switches', 'extraction note', 'file note', 'registry end', 'footer']) {
      expect(result.code).toContain(comment)
    }
    expect(result.code).toContain('satisfies Config')
    expect(result.code).toContain('getEnabled()')
    expect(result.code).toContain(`\`classes-\${name}.json\``)
    expect(result.code.endsWith('\n')).toBe(true)
    expect(migrateConfigSource(result.code)).toEqual({ changed: false, code: result.code, changes: [] })
  })

  it('preserves modern values and deterministic change ordering when merging legacy objects', () => {
    const result = migrateConfigSource(`export default {
      cwd: '.', projectRoot: './modern-root',
      features: { exportContext: true }, applyPatches: { preserve: true },
      apply: { overwrite: true }, overwrite: false,
      output: { enabled: false }, extract: { file: 'classes.json' },
    }`)
    expect(result.changes).toEqual([
      'root.cwd removed (preferred root.projectRoot)',
      'root.features merged into root.apply',
      'root.features removed (preferred root.apply)',
      'root.applyPatches merged into root.apply',
      'root.applyPatches removed (preferred root.apply)',
      'root.output merged into root.extract',
      'root.output removed (preferred root.extract)',
      'root.enabled -> root.write',
      'root.exportContext -> root.exposeContext',
    ])
    expect(result.code).toContain('projectRoot: \'./modern-root\'')
    expect(result.code).toContain('overwrite: true')
    expect(result.code).toContain('write: false')
    expect(result.code.endsWith('\n')).toBe(false)
  })

  it('moves shorthand overwrite while retaining unrelated methods and spreads', () => {
    const result = migrateConfigSource(`const overwrite = false
const extra = { enabled: true }
export default {
  overwrite,
  registry: {
    output: { ...extra, file() { return 'classes.json' }, [getKey()]: 'dynamic' },
    extract: { file: 'modern.json' },
  },
}`)
    expect(result.changed).toBe(true)
    expect(result.code).toContain('overwrite: overwrite')
    expect(result.code).toContain('...extra')
    expect(result.code).toContain('file: \'modern.json\'')
    expect(result.code).toContain('[getKey()]')
    expect(result.code).not.toContain('file()')
    expect(result.changes).toContain('root.apply created')
    expect(result.changes).toContain('root.overwrite -> root.apply.overwrite')
  })

  it('keeps methods and unsupported dynamic targets unchanged and rejects malformed source', () => {
    for (const source of [
      'export default { cwd() { return "." } }',
      'export default { overwrite: false, apply: getOptions() }',
      'export default getConfig(options)',
    ]) {
      expect(migrateConfigSource(source)).toEqual({ changed: false, code: source, changes: [] })
    }
    expect(() => migrateConfigSource('export default { registry:')).toThrow()
    expect(() => migrateConfigSource('let config; let config; export default {cwd:"."}')).toThrow()
  })
})

import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadRuntimeContexts } from '@/runtime/context-registry'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-runtime-ctx-'))
})

afterEach(async () => {
  await fs.remove(tempDir)
})

function createPackageInfo(rootPath: string) {
  return {
    name: 'tailwindcss',
    rootPath,
    version: '3.4.19',
  } as any
}

describe('loadRuntimeContexts', () => {
  it('returns [] for major version 4', () => {
    const result = loadRuntimeContexts(createPackageInfo(tempDir), 4, 'ctx')
    expect(result).toEqual([])
  })

  it('loads v2 contexts from lib/jit/index.js', async () => {
    const entry = path.join(tempDir, 'lib/jit/index.js')
    await fs.ensureDir(path.dirname(entry))
    await fs.writeFile(entry, 'module.exports = { ctx: [{ from: "v2" }] }', 'utf8')

    const result = loadRuntimeContexts(createPackageInfo(tempDir), 2, 'ctx')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: 'v2' })
  })

  it('prefers v3 plugin.js over index.js when both exist', async () => {
    const plugin = path.join(tempDir, 'lib/plugin.js')
    const index = path.join(tempDir, 'lib/index.js')
    await fs.ensureDir(path.dirname(plugin))
    await fs.writeFile(plugin, 'module.exports = { ctx: [{ from: "plugin" }] }', 'utf8')
    await fs.writeFile(index, 'module.exports = { ctx: [{ from: "index" }] }', 'utf8')

    const result = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: 'plugin' })
  })

  it('falls back to v3 index.js when plugin.js is missing', async () => {
    const index = path.join(tempDir, 'lib/index.js')
    await fs.ensureDir(path.dirname(index))
    await fs.writeFile(index, 'module.exports = { ctx: [{ from: "index" }] }', 'utf8')

    const result = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ from: 'index' })
  })

  it('supports ref wrapper objects with value arrays', async () => {
    const index = path.join(tempDir, 'lib/index.js')
    await fs.ensureDir(path.dirname(index))
    await fs.writeFile(index, 'module.exports = { ctx: { value: [{ wrapped: true }] } }', 'utf8')

    const result = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ wrapped: true })
  })

  it('returns [] when entry is missing, module is falsy, or ref is invalid', async () => {
    const noEntry = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(noEntry).toEqual([])

    const index = path.join(tempDir, 'lib/index.js')
    await fs.ensureDir(path.dirname(index))
    await fs.writeFile(index, 'module.exports = undefined', 'utf8')
    const falsyModule = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(falsyModule).toEqual([])

    const invalid = path.join(tempDir, 'lib/plugin.js')
    await fs.writeFile(invalid, 'module.exports = { ctx: 42 }', 'utf8')
    const invalidRef = loadRuntimeContexts(createPackageInfo(tempDir), 3, 'ctx')
    expect(invalidRef).toEqual([])
  })
})

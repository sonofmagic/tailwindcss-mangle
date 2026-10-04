import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { applyExtendLengthUnitsPatchV3, applyExtendLengthUnitsPatchV4 } from '@/patching/operations/extend-length-units'

const fixturesDir = path.resolve(__dirname, 'fixtures/versions')
let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await fs.remove(tempDir)
    tempDir = undefined
  }
})

describe('extend length units patch', () => {
  it('updates Tailwind v3 length units array', () => {
    const libDir = path.join(fixturesDir, '3.3.1')
    const result = applyExtendLengthUnitsPatchV3(libDir, {
      enabled: true,
      units: ['rpx'],
      overwrite: false,
      lengthUnitsFilePath: 'lib/util/dataTypes.js',
      variableName: 'lengthUnits',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain('\'rpx\'')
    expect(result.code).toMatchSnapshot()
  })

  it('adds custom units to v4 distribution bundles', async () => {
    const pkgDir = path.dirname(require.resolve('tailwindcss-4/package.json'))
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwindcss-4-'))
    await fs.copy(pkgDir, tempDir)

    const result = applyExtendLengthUnitsPatchV4(tempDir, {
      enabled: true,
      units: ['rpx'],
      overwrite: false,
    })

    expect(result.changed).toBe(true)
    expect(result.files.length).toBeGreaterThan(0)
    expect(result.files.every(file => file.code.includes('\"rpx\"'))).toBe(true)
    expect(result.files.some(file => !file.hasPatched)).toBe(true)
  })

  it('adds the missing v4 units when another requested unit is already present', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwindcss-4-partial-'))
    const file = path.join(tempDir, 'dist/lib.js')
    await fs.outputFile(file, 'const units = ["cm", "mm", "rpx"];')
    const options = { enabled: true, units: ['rpx', 'upx', 'upx'], overwrite: true }
    const first = applyExtendLengthUnitsPatchV4(tempDir, options)
    expect(first.changed).toBe(true)
    expect(await fs.readFile(file, 'utf8')).toBe('const units = ["cm","mm","rpx","upx"];')
    const second = applyExtendLengthUnitsPatchV4(tempDir, options)
    expect(second.changed).toBe(false)
    expect(second.files[0]?.hasPatched).toBe(true)
  })

  it('does not mistake comments or strings for a v4 unit array', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwindcss-4-decoy-'))
    const content = '// ["cm","mm"]\nconst text = \'["cm","mm"]\';'
    const file = path.join(tempDir, 'dist/lib.js')
    await fs.outputFile(file, content)
    const result = applyExtendLengthUnitsPatchV4(tempDir, { enabled: true, units: ['rpx'], overwrite: true })
    expect(result).toEqual({ changed: false, files: [] })
    expect(await fs.readFile(file, 'utf8')).toBe(content)
  })
})

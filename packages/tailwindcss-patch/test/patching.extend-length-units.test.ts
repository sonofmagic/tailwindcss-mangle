import fs from 'fs-extra'
import os from 'node:os'
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
      units: ['rpx'],
      overwrite: false,
      lengthUnitsFilePath: 'lib/util/dataTypes.js',
      variableName: 'lengthUnits',
    })

    expect(result.changed).toBe(true)
    expect(result.code).toContain("'rpx'")
  })

  it('adds custom units to v4 distribution bundles', async () => {
    const pkgDir = path.dirname(require.resolve('tailwindcss-4/package.json'))
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tailwindcss-4-'))
    await fs.copy(pkgDir, tempDir)

    const result = applyExtendLengthUnitsPatchV4(tempDir, {
      units: ['rpx'],
      overwrite: false,
    })

    expect(result.changed).toBe(true)
    expect(result.files.length).toBeGreaterThan(0)
    expect(result.files[0].code).toContain('"rpx"')
  })
})

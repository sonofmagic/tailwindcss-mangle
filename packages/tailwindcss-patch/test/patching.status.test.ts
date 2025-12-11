import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { TailwindcssPatcher } from '@/api/tailwindcss-patcher'

const fixtureRoot = path.resolve(__dirname, 'fixtures/versions/3.3.1')
let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await fs.remove(tempDir)
    tempDir = undefined
  }
})

describe('patch status reporting', () => {
  it('flags missing patches and confirms applied ones', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-status-'))
    const packageRoot = path.join(tempDir, 'node_modules', 'tailwindcss')
    await fs.ensureDir(path.dirname(packageRoot))
    await fs.copy(fixtureRoot, packageRoot)

    const patcher = new TailwindcssPatcher({
      cwd: tempDir,
      overwrite: true,
      cache: false,
      output: { enabled: false },
      features: {
        extendLengthUnits: {
          enabled: true,
          units: ['rpx'],
        },
      },
      tailwind: {
        version: 3,
        resolve: {
          paths: [tempDir],
        },
      },
    })

    const initialReport = await patcher.getPatchStatus()
    const initialExpose = initialReport.entries.find(entry => entry.name === 'exposeContext')
    const initialUnits = initialReport.entries.find(entry => entry.name === 'extendLengthUnits')

    expect(initialExpose?.status).toBe('not-applied')
    expect(initialUnits?.status).toBe('not-applied')

    await patcher.patch()

    const finalReport = await patcher.getPatchStatus()
    const finalExpose = finalReport.entries.find(entry => entry.name === 'exposeContext')
    const finalUnits = finalReport.entries.find(entry => entry.name === 'extendLengthUnits')

    expect(finalExpose?.status).toBe('applied')
    expect(finalUnits?.status).toBe('applied')
  })
})

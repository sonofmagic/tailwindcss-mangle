import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { TailwindcssPatcher } from '@/api/tailwindcss-patcher'

const fixturesRoot = path.resolve(__dirname, 'fixtures/v4')
let tempDir: string | undefined

afterEach(async () => {
  if (tempDir) {
    await fs.remove(tempDir)
    tempDir = undefined
  }
})

describe('TailwindcssPatcher', () => {
  it('collects classes for Tailwind CSS v4 projects', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tw-patch-'))
    const outputFile = path.join(tempDir, 'classes.json')

    const patcher = new TailwindcssPatcher({
      overwrite: false,
      cache: false,
      output: {
        file: outputFile,
      },
      tailwind: {
        version: 4,
        v4: {
          base: fixturesRoot,
          cssEntries: [path.join(fixturesRoot, 'index.css')],
        },
      },
    })

    const result = await patcher.extract({ write: true })

    expect(result.classList.length).toBeGreaterThan(0)
    expect(await fs.pathExists(outputFile)).toBe(true)
  })
})

import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { snapshotFiles } from '../../../e2e/files'

let tempDir: string

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'twm-e2e-files-'))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})

describe('E2E fixture file restoration', () => {
  it('restores original bytes and removes files that were absent before the test', async () => {
    const classList = path.join(tempDir, '.tw-patch/classes.json')
    const map = path.join(tempDir, '.tw-patch/map.json')
    const unrelated = path.join(tempDir, '.tw-patch/unrelated.json')
    const original = Buffer.from([0x00, 0xFF, 0x0D, 0x0A, 0x80])
    await fs.mkdir(path.dirname(classList), { recursive: true })
    await fs.writeFile(classList, original)

    const restore = await snapshotFiles([classList, map])
    await fs.writeFile(classList, '["generated-class"]')
    await fs.writeFile(map, '["generated-map"]')
    await fs.writeFile(unrelated, 'keep')
    await restore()

    expect(await fs.readFile(classList)).toEqual(original)
    await expect(fs.access(map)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await fs.readFile(unrelated, 'utf8')).toBe('keep')
  })

  it('recreates an original file when a build removes its parent directory', async () => {
    const file = path.join(tempDir, '.tw-patch/classes.json')
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, 'original')
    const restore = await snapshotFiles([file])
    await fs.rm(path.dirname(file), { recursive: true })

    await restore()

    expect(await fs.readFile(file, 'utf8')).toBe('original')
  })

  it('propagates snapshot read failures instead of treating them as missing files', async () => {
    await expect(snapshotFiles([tempDir])).rejects.toMatchObject({ code: 'EISDIR' })
  })

  it('restores the remaining files and reports failures when one restore is blocked', async () => {
    const blocked = path.join(tempDir, 'blocked.json')
    const restorable = path.join(tempDir, 'classes.json')
    await fs.writeFile(blocked, 'blocked original')
    await fs.writeFile(restorable, 'original')
    const restore = await snapshotFiles([blocked, restorable])
    await fs.rm(blocked)
    await fs.mkdir(blocked)
    await fs.writeFile(restorable, 'changed')

    await expect(restore()).rejects.toBeInstanceOf(AggregateError)
    expect(await fs.readFile(restorable, 'utf8')).toBe('original')
  })
})

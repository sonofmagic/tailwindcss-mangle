import { existsSync, statSync } from 'node:fs'
import { deleteAsync } from 'del'
import fs from 'fs-extra'
import path from 'pathe'
import { fixturesRoot } from './utils'

describe('utils', () => {
  it('ensureDir', async () => {
    const dir = path.resolve(fixturesRoot, './xxx/yyy')
    if (existsSync(dir)) {
      await deleteAsync(dir)
    }
    expect(existsSync(dir)).toBe(false)
    await fs.ensureDir(dir)
    const stat = statSync(dir)
    expect(stat.isDirectory()).toBe(true)
    expect(existsSync(dir)).toBe(true)
  })
})

import { ensureDir } from '@/utils'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fixturesRoot } from './utils'
import { deleteAsync } from 'del'

describe('utils', () => {
  it('ensureDir', async () => {
    const dir = path.resolve(fixturesRoot, './xxx/yyy')
    if (existsSync(dir)) {
      await deleteAsync(dir)
    }
    expect(existsSync(dir)).toBe(false)
    await ensureDir(dir)
    const stat = statSync(dir)
    expect(stat.isDirectory()).toBe(true)
    expect(existsSync(dir)).toBe(true)
  })
})

import { initConfig, getConfig } from '@/core/config'
import { fixturesRoot } from './utils'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { deleteAsync } from 'del'
import { getDefaultUserConfig } from '@/defaults'

describe('config', () => {
  it('0.default', async () => {
    const cwd = resolve(fixturesRoot, './config/0.default')
    const configPath = resolve(cwd, 'tailwindcss-patch.config.ts')
    if (existsSync(configPath)) {
      await deleteAsync(configPath)
    }

    await initConfig(cwd)
    expect(existsSync(configPath)).toBe(true)

    const { config } = await getConfig(cwd)
    expect(config).toEqual(getDefaultUserConfig())
  })

  it('1.change-options', async () => {
    const cwd = resolve(fixturesRoot, './config/1.change-options')
    const { config } = await getConfig(cwd)
    expect(config).toEqual({
      output: {
        filename: 'xxx/yyy/zzz.json',
        loose: false,
        removeUniversalSelector: false
      },
      tailwindcss: {
        cwd: 'aaa/bbb/cc'
      }
    })
  })
})

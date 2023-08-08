import { initConfig, getConfig, getDefaultUserConfig } from '@/core/config'
import { fixturesRoot } from './utils'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { deleteAsync } from 'del'

describe('config', () => {
  it('0.default', async () => {
    const cwd = resolve(fixturesRoot, './config/0.default')
    const configPath = resolve(cwd, 'tailwindcss-mangle.config.ts')
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
      patch: {
        output: {
          filename: 'xxx/yyy/zzz.json',
          loose: false,
          removeUniversalSelector: false
        },
        tailwindcss: {
          cwd: 'aaa/bbb/cc'
        }
      }
    })
  })
})

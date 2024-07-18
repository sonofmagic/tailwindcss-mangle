import { resolve } from 'node:path'
import { existsSync } from 'fs-extra'
import { deleteAsync } from 'del'
import { fixturesRoot } from './utils'
import { getConfig, initConfig } from '@/index'
import { getDefaultMangleUserConfig, getDefaultUserConfig } from '@/defaults'
import { configName } from '@/constants'

describe('config', () => {
  it('0.default', async () => {
    const cwd = resolve(fixturesRoot, './config/0.default')
    const configPath = resolve(cwd, `${configName}.config.ts`)
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
          removeUniversalSelector: false,
        },
        tailwindcss: {
          cwd: 'aaa/bbb/cc',
        },
      },
      mangle: getDefaultMangleUserConfig(),
    })
  })

  it('2.mangle-options', async () => {
    const cwd = resolve(fixturesRoot, './config/2.mangle-options')
    const { config } = await getConfig(cwd)
    expect(config).toMatchSnapshot()
  })
})

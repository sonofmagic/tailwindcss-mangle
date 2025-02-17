import { getConfig, getDefaultMangleUserConfig, getDefaultUserConfig, initConfig } from '@tailwindcss-mangle/config'
import { deleteAsync } from 'del'
import { existsSync } from 'fs-extra'
import { resolve } from 'pathe'
import { fixturesRoot } from './utils'

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
          removeUniversalSelector: false,
        },
        tailwindcss: {
          cwd: 'aaa/bbb/cc',
        },
      },
      mangle: getDefaultMangleUserConfig(),
    })
  })
})

import fs from 'fs-extra'
import os from 'node:os'
import path from 'pathe'
import { defineConfig, getConfig, initConfig } from '@/config'
import { getDefaultUserConfig } from '@/defaults'

describe('config', () => {
  it('init config', async () => {
    const cwd = path.resolve(__dirname, './fixtures/config/initConfig')
    await initConfig(cwd)
    const dest = path.resolve(cwd, 'tailwindcss-mangle.config.ts')
    expect(await fs.readFile(dest, 'utf8')).toMatchSnapshot()
  })

  it('defineConfig helper returns provided config', () => {
    const config = defineConfig({
      patch: {
        output: {
          filename: 'custom.json',
        },
      },
    })

    expect(config).toEqual({
      patch: {
        output: {
          filename: 'custom.json',
        },
      },
    })
  })

  it('getConfig falls back to defaults when config file is absent', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'))
    const { config } = await getConfig(tempDir)
    expect(config).toEqual(getDefaultUserConfig())
    await fs.remove(tempDir)
  })
})

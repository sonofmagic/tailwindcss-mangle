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
      registry: {
        output: {
          file: 'custom.json',
        },
      },
    })

    expect(config).toEqual({
      registry: {
        output: {
          file: 'custom.json',
        },
      },
    })
  })

  it('defineConfig helper accepts modern registry options', () => {
    const config = defineConfig({
      registry: {
        projectRoot: 'apps/demo-a',
        extract: {
          file: 'classes.txt',
          format: 'lines',
        },
        tailwindcss: {
          version: 4,
        },
      },
    })

    expect(config).toEqual({
      registry: {
        projectRoot: 'apps/demo-a',
        extract: {
          file: 'classes.txt',
          format: 'lines',
        },
        tailwindcss: {
          version: 4,
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

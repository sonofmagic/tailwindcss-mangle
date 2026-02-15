import { deleteAsync } from 'del'
import { existsSync } from 'fs-extra'
import { resolve } from 'pathe'
import { CONFIG_NAME } from '@/constants'
import { getDefaultTransformerConfig, getDefaultUserConfig } from '@/defaults'
import { getConfig, initConfig } from '@/index'
import { fixturesRoot } from './utils'

function normaliseRegex(value: any): any {
  if (Array.isArray(value)) {
    return value.map(normaliseRegex)
  }
  if (value instanceof RegExp) {
    return value.toString()
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, normaliseRegex(val)]))
  }
  return value
}

describe('config', () => {
  it('0.default', async () => {
    const cwd = resolve(fixturesRoot, './config/0.default')
    const configPath = resolve(cwd, `${CONFIG_NAME}.config.ts`)
    if (existsSync(configPath)) {
      await deleteAsync(configPath)
    }

    await initConfig(cwd)
    expect(existsSync(configPath)).toBe(true)

    const { config } = await getConfig(cwd)
    expect(normaliseRegex(config)).toEqual(normaliseRegex(getDefaultUserConfig()))
  })

  it('1.change-options', async () => {
    const cwd = resolve(fixturesRoot, './config/1.change-options')
    const { config } = await getConfig(cwd)
    expect(config).toEqual({
      registry: {
        extract: {
          file: '.tw-patch/tw-class-list.json',
        },
        output: {
          file: 'xxx/yyy/zzz.json',
          pretty: false,
          stripUniversalSelector: false,
        },
        tailwindcss: {},
        tailwind: {
          cwd: 'aaa/bbb/cc',
        },
      },
      transformer: getDefaultTransformerConfig(),
    })
  })

  it('2.transformer-options', async () => {
    const cwd = resolve(fixturesRoot, './config/2.transformer-options')
    const { config } = await getConfig(cwd)
    expect(normaliseRegex(config)).toMatchSnapshot()
  })

  it('3.modern-options', async () => {
    const cwd = resolve(fixturesRoot, './config/3.modern-options')
    const { config } = await getConfig(cwd)
    expect(normaliseRegex(config)).toEqual(normaliseRegex({
      registry: {
        output: {
          file: '.tw-patch/tw-class-list.json',
          pretty: true,
          stripUniversalSelector: true,
        },
        tailwind: {},
        projectRoot: 'apps/demo-a',
        extract: {
          write: false,
          file: 'modern/classes.txt',
          format: 'lines',
          pretty: false,
          removeUniversalSelector: false,
        },
        apply: {
          overwrite: false,
          exposeContext: {
            refProperty: 'runtimeContexts',
          },
          extendLengthUnits: {
            units: ['rpx', 'vh'],
          },
        },
        tailwindcss: {
          packageName: 'tailwindcss-modern',
          version: 4,
          v4: {
            cssEntries: ['dist/tailwind.css'],
          },
        },
        cache: {
          enabled: true,
          dir: '.cache/modern',
          strategy: 'overwrite',
        },
      },
      transformer: getDefaultTransformerConfig(),
    }))
  })
})

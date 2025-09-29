import { createFilter } from '@rollup/pluginutils'
import { omit } from 'lodash-es'
import { getDefaultMangleUserConfig, getDefaultPatchConfig, getDefaultUserConfig } from '@/defaults'

function omitCwdPath(o: any) {
  return omit(o, ['tailwindcss.cwd', 'patch.tailwindcss.cwd'])
}

describe('defaults', () => {
  it('getDefaultPatchConfig', () => {
    expect(omitCwdPath(getDefaultPatchConfig())).toMatchSnapshot()
  })

  it('getDefaultUserConfig', () => {
    expect(omitCwdPath(getDefaultUserConfig())).toMatchSnapshot()
  })

  it('getDefaultMangleUserConfig reflects NODE_ENV', () => {
    const originalEnv = process.env.NODE_ENV

    vi.stubEnv('NODE_ENV', 'development')
    expect(getDefaultMangleUserConfig().disabled).toBe(true)
    vi.unstubAllEnvs()

    vi.stubEnv('NODE_ENV', 'production')
    expect(getDefaultMangleUserConfig().disabled).toBe(false)
    vi.unstubAllEnvs()

    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv
    }
    else {
      delete process.env.NODE_ENV
    }
  })
})

describe('createFilter', () => {
  it('case 0', () => {
    const config = getDefaultUserConfig()
    const filter = createFilter(config.mangle?.include, config.mangle?.exclude)
    expect(filter('xx/yy.js?a=1')).toBe(true)
  })
})

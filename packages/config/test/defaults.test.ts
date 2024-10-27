import { getDefaultPatchConfig, getDefaultUserConfig } from '@/defaults'
import { createFilter } from '@rollup/pluginutils'
import { omit } from 'lodash-es'

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
})

describe('createFilter', () => {
  it('case 0', () => {
    const config = getDefaultUserConfig()
    const filter = createFilter(config.mangle?.include, config.mangle?.exclude)
    expect(filter('xx/yy.js?a=1')).toBe(true)
  })
})

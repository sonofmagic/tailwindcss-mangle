import { getDefaultPatchConfig, getDefaultUserConfig } from '@/defaults'
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

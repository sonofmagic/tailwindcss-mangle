import { getDefaultPatchOptions, getDefaultUserConfig } from '@/defaults'

describe('defaults', () => {
  it('getDefaultPatchOptions', () => {
    expect(getDefaultPatchOptions()).toMatchSnapshot()
  })

  it('getDefaultUserConfig', () => {
    expect(getDefaultUserConfig().output).toMatchSnapshot()
  })
})

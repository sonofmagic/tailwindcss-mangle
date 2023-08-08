import { getDefaultPatchOptions } from '@/defaults'

describe('defaults', () => {
  it('getDefaultPatchOptions', () => {
    expect(getDefaultPatchOptions()).toMatchSnapshot()
  })
})

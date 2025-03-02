import path from 'node:path'
import { monkeyPatchForSupportingCustomUnitV4 } from '@/core/patches/supportCustomUnits/index'
import { fixturesRoot } from './utils'

describe('patch', () => {
  describe('monkeyPatchForSupportingCustomUnitV4', () => {
    it('should patch v4', () => {
      const { files } = monkeyPatchForSupportingCustomUnitV4(path.resolve(fixturesRoot, 'v4/patch'), {

      })
      expect(files.map((x) => {
        return {
          code: x.code,
          hasPatched: x.hasPatched,
        }
      })).toMatchSnapshot()
    })
  })
})

import { getInstalledPkgJsonPath } from '../src/patcher'
import path from 'path'

describe('patcher', () => {
  it('getInstalledPkgJsonPath common options', () => {
    const pkgJsonPath = getInstalledPkgJsonPath()
    expect(pkgJsonPath).toBeTruthy()
    pkgJsonPath && expect(path.relative(process.cwd(), pkgJsonPath)).toMatchSnapshot()
  })

  it('getInstalledPkgJsonPath baseDir options', () => {
    const pkgJsonPath = getInstalledPkgJsonPath({
      basedir: path.resolve(__dirname, '../../../')
    })
    expect(pkgJsonPath).toBeTruthy()
  })
})

import { getInstalledPkgJsonPath } from '../src/core/patcher'
import path from 'node:path'

describe('patcher', () => {
  it('getInstalledPkgJsonPath common options', () => {
    const pkgJsonPath = getInstalledPkgJsonPath()
    expect(pkgJsonPath).toBeTruthy()
    pkgJsonPath && expect(path.relative(process.cwd(), pkgJsonPath).replaceAll('\\', '/')).toContain('node_modules/tailwindcss/package.json')
  })

  it('getInstalledPkgJsonPath baseDir options', () => {
    const pkgJsonPath = getInstalledPkgJsonPath({
      basedir: path.resolve(__dirname, '../../../')
    })
    expect(pkgJsonPath).toBeTruthy()
  })
})

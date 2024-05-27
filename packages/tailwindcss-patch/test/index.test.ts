import path from 'node:path'
import { internalPatch } from '@/core'

const tailwindcssCasePath = path.resolve(__dirname, 'fixtures')
const versionsPkgDir = path.resolve(tailwindcssCasePath, 'versions/package.json')

function getTailwindcssVersion(str: string) {
  const match = /^tailwindcss([\d.]*)$/.exec(str)
  if (match === null) {
    // 不是 tailwindcss
    return false
  }
  else if (match[1] === '') {
    return 'lts'
  }
  else {
    return match[1]
  }
}

const pkg = require(versionsPkgDir)
const versions = Object.keys(pkg.dependencies)

describe('versions-patch', () => {
  it.each(versions)('patch %s', (version) => {
    const v = getTailwindcssVersion(version)

    const res = internalPatch(path.resolve(tailwindcssCasePath, `versions/${v}/package.json`), {
      overwrite: false,
    })
    expect(res).toMatchSnapshot()
  })
})

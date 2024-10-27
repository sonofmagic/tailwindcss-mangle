import { createRequire } from 'node:module'
import { internalPatch } from '@/core'
import path from 'pathe'

const tailwindcssCasePath = path.resolve(__dirname, 'fixtures')
const versionsPkgDir = path.resolve(tailwindcssCasePath, 'versions/package.json')
const require = createRequire(import.meta.url)
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
      applyPatches: {
        exportContext: true,
      },
    })
    expect(res).toMatchSnapshot()
  })

  it.each(versions)('patch custom unit %s', (version) => {
    const v = getTailwindcssVersion(version)

    const res = internalPatch(path.resolve(tailwindcssCasePath, `versions/${v}/package.json`), {
      overwrite: false,
      applyPatches: {
        exportContext: true,
        extendLengthUnits: true,
      },
    })
    expect(res).toMatchSnapshot()
  })

  it.each(versions)('patch custom unit options %s', (version) => {
    const v = getTailwindcssVersion(version)

    const res = internalPatch(path.resolve(tailwindcssCasePath, `versions/${v}/package.json`), {
      overwrite: false,
      applyPatches: {
        exportContext: true,
        extendLengthUnits: {
          units: ['rpx', 'rrpx', 'rrrpx'],
        },
      },
    })
    expect(res).toMatchSnapshot()
  })
})

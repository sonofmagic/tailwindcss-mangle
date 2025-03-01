import { isCI } from 'ci-info'
import { getPackageInfoSync } from 'local-pkg'
import { gte } from 'semver'

describe.skipIf(isCI)('pkg', () => {
  it('tailwindcss', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss')
    // @ts-ignore
    expect(gte(tailwindcss?.packageJson.version, '3.4.17')).toBe(true)
  })

  it('tailwindcss paths 0', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss', {
      paths: [import.meta.dirname],
    })
    // @ts-ignore
    expect(gte(tailwindcss?.packageJson.version, '4.0.0')).toBe(true)
  })

  it('tailwindcss paths 1', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss', {
      paths: [process.cwd()],
    })
    expect(tailwindcss?.packageJson.version).toBe('3.4.17')
  })

  it('tailwindcss3', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss-3')
    expect(tailwindcss?.packageJson.version).toBe('3.4.17')
  })

  // it('tailwindcss4', () => {
  //   const tailwindcss = getPackageInfoSync('tailwindcss-4')
  //   expect(tailwindcss?.packageJson.version).toBe('4.0.6')
  // })
})

import { isCI } from 'ci-info'
import { getPackageInfoSync } from 'local-pkg'

describe.skipIf(isCI)('pkg', () => {
  it('tailwindcss', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss')
    expect(tailwindcss?.packageJson.version).toBe('3.4.17')
  })

  it('tailwindcss paths 0', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss', {
      paths: [import.meta.dirname],
    })
    expect(tailwindcss?.packageJson.version).toBe('4.0.6')
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

  it('tailwindcss4', () => {
    const tailwindcss = getPackageInfoSync('tailwindcss-4')
    expect(tailwindcss?.packageJson.version).toBe('4.0.6')
  })
})

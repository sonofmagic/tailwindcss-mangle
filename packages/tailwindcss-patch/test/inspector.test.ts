import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from '@/core/patches/exportContext/postcss-v3'
import fs from 'fs-extra'
import path from 'pathe'

const tailwindcssCasePath = path.resolve(__dirname, 'fixtures')
const twltsLibPath = path.resolve(tailwindcssCasePath, 'versions/3.3.1/lib')

describe('inspector', () => {
  it('inspectPostcssPlugin patch snap', () => {
    const rawCode = fs.readFileSync(path.resolve(twltsLibPath, 'plugin.js'), 'utf8')
    const { code, hasPatched } = inspectPostcssPlugin(rawCode)
    expect(hasPatched).toBe(false)
    expect(code).toMatchSnapshot()
    const { code: newCode, hasPatched: hasPatched0 } = inspectPostcssPlugin(code)
    expect(hasPatched0).toBe(true)
    expect(code).toBe(newCode)
  })

  it('inspectProcessTailwindFeaturesReturnContext patch snap', () => {
    const rawCode = fs.readFileSync(path.resolve(twltsLibPath, 'processTailwindFeatures.js'), 'utf8')
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(rawCode)
    expect(hasPatched).toBe(false)
    expect(code).toMatchSnapshot()
    const { code: newCode, hasPatched: hasPatched0 } = inspectProcessTailwindFeaturesReturnContext(code)
    expect(hasPatched0).toBe(true)
    expect(code).toBe(newCode)
  })
})

import path from 'path'
import fs from 'fs'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from '../src/inspector'
const tailwindcssCasePath = path.resolve(__dirname, 'fixtures')
const twltsLibPath = path.resolve(tailwindcssCasePath, 'versions/lts/lib')

describe('inspector', () => {
  it('inspectPostcssPlugin patch snap', () => {
    const rawCode = fs.readFileSync(path.resolve(twltsLibPath, 'plugin.js'), 'utf-8')
    const { code, hasPatched } = inspectPostcssPlugin(rawCode)
    expect(hasPatched).toBe(false)
    expect(code).toMatchSnapshot()
    const { code: newCode, hasPatched: hasPatched0 } = inspectPostcssPlugin(code)
    expect(hasPatched0).toBe(true)
    expect(code).toBe(newCode)
  })

  it('inspectProcessTailwindFeaturesReturnContext patch snap', () => {
    const rawCode = fs.readFileSync(path.resolve(twltsLibPath, 'processTailwindFeatures.js'), 'utf-8')
    const { code, hasPatched } = inspectProcessTailwindFeaturesReturnContext(rawCode)
    expect(hasPatched).toBe(false)
    expect(code).toMatchSnapshot()
    const { code: newCode, hasPatched: hasPatched0 } = inspectProcessTailwindFeaturesReturnContext(code)
    expect(hasPatched0).toBe(true)
    expect(code).toBe(newCode)
  })
})

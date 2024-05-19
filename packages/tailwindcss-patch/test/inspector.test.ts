import path from 'node:path'
import fs from 'node:fs'
import { inspectPostcssPlugin, inspectProcessTailwindFeaturesReturnContext } from '@/core'

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

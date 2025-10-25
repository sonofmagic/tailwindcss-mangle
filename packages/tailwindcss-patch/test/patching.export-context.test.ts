import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { transformPostcssPluginV2, transformProcessTailwindFeaturesReturnContextV2 } from '@/patching/operations/export-context/postcss-v2'
import { transformPostcssPlugin, transformProcessTailwindFeaturesReturnContext } from '@/patching/operations/export-context/postcss-v3'

const fixturesDir = path.resolve(__dirname, 'fixtures/versions')
const v3Fixtures = ['3.3.1', '3.4.17', '3.4.18']

describe.each(v3Fixtures)('export context patch (v3) - tailwind %s', (version) => {
  const libDir = path.join(fixturesDir, `${version}/lib`)

  it('adds context collection logic to plugin entry', () => {
    const source = fs.readFileSync(path.join(libDir, 'plugin.js'), 'utf8')
    const { code, hasPatched } = transformPostcssPlugin(source, { refProperty: 'runtimeContexts' })

    expect(hasPatched).toBe(false)
    expect(code).toContain('runtimeContexts = {')
    expect(code).toContain('module.exports.runtimeContexts = runtimeContexts')
    expect(code).toContain('runtimeContexts.value.push')

    const secondPass = transformPostcssPlugin(code, { refProperty: 'runtimeContexts' })
    expect(secondPass.hasPatched).toBe(true)
    expect(secondPass.code).toBe(code)
    expect(code).toMatchSnapshot()
  })

  it('ensures processTailwindFeatures returns the runtime context', () => {
    const source = fs.readFileSync(path.join(libDir, 'processTailwindFeatures.js'), 'utf8')
    const { code, hasPatched } = transformProcessTailwindFeaturesReturnContext(source)

    expect(hasPatched).toBe(false)
    expect(code).toContain('return context')

    const secondPass = transformProcessTailwindFeaturesReturnContext(code)
    expect(secondPass.hasPatched).toBe(true)
    expect(secondPass.code).toBe(code)
    expect(code).toMatchSnapshot()
  })
})

describe('export context patch (v2)', () => {
  const libDir = path.join(fixturesDir, '2/lib/jit')

  it('augments tailwindcss jit plugin to collect contexts', () => {
    const source = fs.readFileSync(path.join(libDir, 'index.js'), 'utf8')
    const { code, hasPatched } = transformPostcssPluginV2(source, { refProperty: 'contextRef' })

    expect(hasPatched).toBe(false)
    expect(code).toContain('contextRef = {')
    expect(code).toContain('exports.contextRef = contextRef')
    expect(code).toContain('contextRef.value.push')

    const secondPass = transformPostcssPluginV2(code, { refProperty: 'contextRef' })
    expect(secondPass.hasPatched).toBe(true)
    expect(secondPass.code).toBe(code)
  })

  it('ensures jit processTailwindFeatures returns context', () => {
    const source = fs.readFileSync(path.join(libDir, 'processTailwindFeatures.js'), 'utf8')
    const { code, hasPatched } = transformProcessTailwindFeaturesReturnContextV2(source)

    expect(hasPatched).toBe(false)
    expect(code).toContain('return context')
    const secondPass = transformProcessTailwindFeaturesReturnContextV2(code)
    expect(secondPass.hasPatched).toBe(true)
  })
})

import vm from 'node:vm'
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

describe.each([2, 3] as const)('export context runtime contract (v%s)', (version) => {
  it('collects document contexts, resets between runs, and supports custom export keys', () => {
    const plugin = `function(root) {
      if (root.type === 'document') {
        const roots = root.nodes;
        for (const node of roots) {
          if (node.type === 'root') { processTailwindFeatures(node); }
        }
        return;
      }
      processTailwindFeatures(root);
    }`
    const source = version === 2
      ? `function _default() { return [null, ${plugin}].filter(Boolean); } exports.default = _default;`
      : `module.exports = function tailwindcss() { return { postcssPlugin: 'tailwindcss', plugins: [null, ${plugin}].filter(Boolean) }; };`
    const transform = version === 2 ? transformPostcssPluginV2 : transformPostcssPlugin
    const options = { refProperty: '123-contexts' }
    const patched = transform(source, options)
    const exports: Record<string, any> = {}
    const module = { exports: {} as any }
    vm.runInNewContext(patched.code, {
      exports,
      module,
      processTailwindFeatures: (root: { context: string }) => root.context,
    })
    const callback = version === 2 ? exports['default']()[0] : module.exports().plugins[0]
    const reference = (version === 2 ? exports : module.exports)[options.refProperty]
    callback({ type: 'document', nodes: [{ type: 'root', context: 'first' }, { type: 'root', context: 'second' }] })
    expect(Array.from(reference.value)).toEqual(['first', 'second'])
    callback({ type: 'root', context: 'next-run' })
    expect(Array.from(reference.value)).toEqual(['next-run'])
    const secondPass = transform(patched.code, options)
    expect(secondPass.hasPatched).toBe(true)
    expect(secondPass.code).toBe(patched.code)
  })
})

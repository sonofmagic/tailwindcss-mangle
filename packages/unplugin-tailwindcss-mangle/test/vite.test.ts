import { build } from 'vite'
import { describe, it, expect, beforeEach } from 'vitest'
import path from 'node:path'
import { RollupOutput } from 'rollup'
import utwm from '../src/vite'
import { TailwindcssPatcher } from 'tailwindcss-patch'
describe('vite build', () => {
  let twPatcher: TailwindcssPatcher
  beforeEach(() => {
    twPatcher = new TailwindcssPatcher()
    twPatcher.patch()
  })
  it('common build ', async () => {
    const res = (await build({
      root: path.resolve(__dirname, 'fixtures/vite-repo'),
      build: {
        write: false
      },
      plugins: [utwm()]
    })) as RollupOutput
    const output = res.output
    expect(output.length).toBe(3)
    const jsFile = output[0]
    expect(jsFile.type).toBe('chunk')
    expect(jsFile.code).toMatchSnapshot()
    expect(jsFile.code).toContain('ease-out')
    expect(output[1].type).toBe('asset')
    if (output[1].type === 'asset') {
      expect(output[1].source).toMatchSnapshot()
    }
    expect(output[2].type).toBe('asset')
    if (output[2].type === 'asset') {
      expect(output[2].source).toMatchSnapshot()
    }
  })
})

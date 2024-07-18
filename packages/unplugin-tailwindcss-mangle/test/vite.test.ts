import path from 'node:path'
import { build } from 'vite'
import type { RollupOutput } from 'rollup'
import { minify } from 'html-minifier-terser'
import utwm from '@/vite'

const appRoot = path.resolve(__dirname, 'fixtures/vite-repo')
describe('vite build', () => {
  it('common build ', async () => {
    const res = (await build({
      root: appRoot,
      build: {
        write: false,
        cssMinify: false,
        rollupOptions: {
          output: {
            entryFileNames: `[name].js`,
            chunkFileNames: `[name].js`,
            assetFileNames: `[name].[ext]`,
          },
        },
      },
      plugins: [
        utwm({
          classListPath: path.resolve(appRoot, '.tw-patch/tw-class-list.json'),
        }),
      ],
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

  it('common build change class prefix', async () => {
    const res = (await build({
      root: appRoot,
      build: {
        write: false,
        cssMinify: false,
        rollupOptions: {
          output: {
            entryFileNames: `[name].js`,
            chunkFileNames: `[name].js`,
            assetFileNames: `[name].[ext]`,
          },
        },
      },
      plugins: [
        utwm({
          classListPath: path.resolve(appRoot, '.tw-patch/tw-class-list.json'),
          classGenerator: {
            classPrefix: 'ice-',
          },
        }),
      ],
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
      const res = await minify(output[2].source.toString(), {
      })
      expect(res).toMatchSnapshot()
    }
  })
})

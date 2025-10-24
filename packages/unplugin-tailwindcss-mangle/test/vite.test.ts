import type { RollupOutput } from 'rollup'
import path from 'pathe'
import { build } from 'vite'
import utwm from '@/vite'
// .replace(/(\r?\n){3,}/g, '\n\n')
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
          registry: {
            file: path.resolve(appRoot, '.tw-patch/tw-class-list.json'),
          },
        }),
      ],
    })) as RollupOutput
    const output = res.output
    expect(output.length).toBe(3)
    const jsFile = output[0]
    expect(jsFile.type).toBe('chunk')
    expect(jsFile.code).toContain('ease-out')
    const cssAsset = output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    expect(cssAsset?.type).toBe('asset')
    if (cssAsset?.type === 'asset') {
      const css = cssAsset.source.toString()
      expect(css).toContain('.tw-')
      expect(css).not.toContain('bg-[#123456]')
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
          registry: {
            file: path.resolve(appRoot, '.tw-patch/tw-class-list.json'),
          },
          generator: {
            classPrefix: 'ice-',
          },
        }),
      ],
    })) as RollupOutput
    const output = res.output
    expect(output.length).toBe(3)
    const jsFile = output[0]
    expect(jsFile.type).toBe('chunk')
    expect(jsFile.code).toContain('ease-out')
    const cssAsset = output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    expect(cssAsset?.type).toBe('asset')
    if (cssAsset?.type === 'asset') {
      const css = cssAsset.source.toString()
      expect(css).toContain('.ice-')
      expect(css).not.toContain('.tw-')
    }
  })
})

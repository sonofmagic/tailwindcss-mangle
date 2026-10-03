import path from 'pathe'
import { build } from 'vite'
import utwm from '@/vite'
// .replace(/(\r?\n){3,}/g, '\n\n')
const appRoot = path.resolve(__dirname, 'fixtures/vite-repo')
describe('vite build', () => {
  it('common build ', async () => {
    const res = await build({
      root: appRoot,
      build: {
        write: false,
        cssMinify: false,
        rolldownOptions: {
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
    })
    if (Array.isArray(res) || !('output' in res)) {
      throw new Error('Expected a single Vite build output')
    }
    const output = res.output
    expect(output.length).toBe(3)
    const jsFile = output.find(file => file.type === 'chunk')
    expect(jsFile).toBeDefined()
    expect(jsFile?.code).toContain('ease-out')
    const cssAsset = output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    expect(cssAsset?.type).toBe('asset')
    if (cssAsset?.type === 'asset') {
      const css = cssAsset.source.toString()
      expect(css).toContain('.tw-')
      expect(css).not.toContain('bg-[#123456]')
    }
  })

  it('common build change class prefix', async () => {
    const res = await build({
      root: appRoot,
      build: {
        write: false,
        cssMinify: false,
        rolldownOptions: {
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
    })
    if (Array.isArray(res) || !('output' in res)) {
      throw new Error('Expected a single Vite build output')
    }
    const output = res.output
    expect(output.length).toBe(3)
    const jsFile = output.find(file => file.type === 'chunk')
    expect(jsFile).toBeDefined()
    expect(jsFile?.code).toContain('ease-out')
    const cssAsset = output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'))
    expect(cssAsset?.type).toBe('asset')
    if (cssAsset?.type === 'asset') {
      const css = cssAsset.source.toString()
      expect(css).toContain('.ice-')
      expect(css).not.toContain('.tw-')
    }
  })
})

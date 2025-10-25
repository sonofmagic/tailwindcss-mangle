import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import path from 'pathe'
import { compile, getErrors, getMemfsCompiler5, getWarnings, readAssets } from 'webpack-build-utils'
import utwm from '@/webpack'

const context = path.resolve(__dirname, 'fixtures/webpack-repo')
describe('webpack build', () => {
  it('common', async () => {
    const compiler = getMemfsCompiler5({
      mode: 'production',
      entry: path.resolve(context, './src/index.js'),
      context,
      plugins: [new MiniCssExtractPlugin()],
      output: {
        path: path.resolve(context, './dist'),
        filename: 'index.js',
      },
      module: {
        rules: [
          {
            test: /\.css$/i,
            type: 'javascript/auto',
            use: [
              MiniCssExtractPlugin.loader,
              {
                loader: 'css-loader',
                options: {
                  url: false,
                },
              },
              'postcss-loader',
            ],
          },
        ],
      },
    })
    const stats = await compile(compiler)

    // get all Assets as Record<string,string>
    const assets = readAssets(compiler, stats)
    const cssAssetName = Object.keys(assets).find(name => name.endsWith('.css'))
    expect(cssAssetName).toBeDefined()
    expect(typeof assets[cssAssetName!]).toBe('string')
    expect(assets[cssAssetName!].length).toBeGreaterThan(0)
    expect(assets['index.js']).toBeDefined()
    // get all error
    expect(getErrors(stats)).toEqual([])
    // get all warnings
    expect(getWarnings(stats)).toEqual([])
  })

  it.skip('with plugin', async () => {
    const compiler = getMemfsCompiler5({
      mode: 'production',
      entry: path.resolve(context, './src/index.js'),
      context,
      plugins: [new MiniCssExtractPlugin()],
      output: {
        path: path.resolve(context, './dist'),
        filename: 'index.js',
      },
      module: {
        rules: [
          {
            test: /\.css$/i,
            type: 'javascript/auto',
            use: [
              MiniCssExtractPlugin.loader,
              {
                loader: 'css-loader',
                options: {
                  url: false,
                },
              },
              'postcss-loader',
            ],
          },
        ],
      },
    })

    utwm({
      registry: {
        file: path.resolve(context, '.tw-patch/tw-class-list.json'),
      },
    }).apply(compiler)
    const stats = await compile(compiler)

    // get all Assets as Record<string,string>
    const assets = readAssets(compiler, stats)
    const cssAssetName = Object.keys(assets).find(name => name.endsWith('.css'))
    expect(cssAssetName).toBeDefined()
    expect(assets[cssAssetName!]).toContain('.tw-')
    expect(assets['index.js']).toBeDefined()
    // get all error
    expect(getErrors(stats)).toEqual([])
    // get all warnings
    expect(getWarnings(stats)).toEqual([])
  })

  // webpack({}, (err, stats) => {
  //   if (err || stats.hasErrors()) {
  //     // ...
  //   }
  //   // Done processing
  // });
})

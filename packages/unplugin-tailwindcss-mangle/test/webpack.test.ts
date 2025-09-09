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
            use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
          },
        ],
      },
    })
    const stats = await compile(compiler)

    // get all Assets as Record<string,string>
    expect(readAssets(compiler, stats)).toMatchSnapshot('assets')
    // get all error
    expect(getErrors(stats)).toMatchSnapshot('errors')
    // get all warnings
    expect(getWarnings(stats)).toMatchSnapshot('warnings')
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
            use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
          },
        ],
      },
    })

    utwm({
      classListPath: path.resolve(context, '.tw-patch/tw-class-list.json'),
    }).apply(compiler)
    const stats = await compile(compiler)

    // get all Assets as Record<string,string>
    expect(readAssets(compiler, stats)).toMatchSnapshot('assets')
    // get all error
    expect(getErrors(stats)).toMatchSnapshot('errors')
    // get all warnings
    expect(getWarnings(stats)).toMatchSnapshot('warnings')
  })

  // webpack({}, (err, stats) => {
  //   if (err || stats.hasErrors()) {
  //     // ...
  //   }
  //   // Done processing
  // });
})

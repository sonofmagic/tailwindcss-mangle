import webpack from 'webpack'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
describe('webpack build', () => {
  it('common', () => {
    const compiler = webpack(
      {
        mode: 'production',
        entry: ['./index.js'],
        context: path.resolve(__dirname, 'fixtures/webpack-repo')
      },
      (err, stats) => {}
    )
  })
  // webpack({}, (err, stats) => {
  //   if (err || stats.hasErrors()) {
  //     // ...
  //   }
  //   // Done processing
  // });
})

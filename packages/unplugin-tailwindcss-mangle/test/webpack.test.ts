import webpack from 'webpack'
import { describe, it, expect } from 'vitest'

describe('webpack build', () => {
  it('common', () => {
    expect(true).toBe(true)
  })
  // webpack({}, (err, stats) => {
  //   if (err || stats.hasErrors()) {
  //     // ...
  //   }
  //   // Done processing
  // });
})

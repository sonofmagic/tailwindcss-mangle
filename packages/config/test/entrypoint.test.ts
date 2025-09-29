import * as entry from '@/index'

describe('entrypoint exports', () => {
  it('exposes defineConfig and helpers', () => {
    expect(typeof entry.defineConfig).toBe('function')
    expect(typeof entry.getConfig).toBe('function')
    expect(typeof entry.getDefaultUserConfig).toBe('function')
  })
})

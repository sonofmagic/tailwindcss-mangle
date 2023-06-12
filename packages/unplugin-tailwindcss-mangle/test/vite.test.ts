import { build } from 'vite'
import { describe, it, expect } from 'vitest'
import path from 'node:path'
describe('vite build', () => {
  it('common build ', async () => {
    const res = await build({
      root: path.resolve(__dirname, 'fixtures/vite-repo'),
      build: {
        write: false
      }
    })
    console.log(res)
  })
})

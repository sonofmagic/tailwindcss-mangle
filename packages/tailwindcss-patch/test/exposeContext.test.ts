import path from 'node:path'
import { getTailwindcssEntry } from '@/core/exposeContext'
describe('exposeContext', () => {
  it('getTailwindcssEntry', () => {
    const dirname = __dirname
    let p = getTailwindcssEntry()

    expect(path.relative(dirname, p)).toBe('../node_modules/tailwindcss/lib/index.js')
    let basedir = path.resolve(dirname, '../../../')
    p = getTailwindcssEntry(basedir)
    expect(path.relative(basedir, p)).toBe('node_modules/tailwindcss/lib/index.js')

    basedir = path.resolve(dirname, '../../../apps/vite-react')
    p = getTailwindcssEntry(basedir)
    expect(path.relative(basedir, p)).toBe('node_modules/tailwindcss/lib/index.js')
  })
})

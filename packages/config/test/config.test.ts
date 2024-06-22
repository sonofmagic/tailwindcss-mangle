import fs from 'fs-extra'
import path from 'pathe'
import { initConfig } from '@/config'

describe('config', () => {
  it('init config', async () => {
    const cwd = path.resolve(__dirname, './fixtures/config/initConfig')
    await initConfig(cwd)
    const dest = path.resolve(cwd, 'tailwindcss-mangle.config.ts')
    expect(await fs.readFile(dest, 'utf8')).toMatchSnapshot()
  })
})

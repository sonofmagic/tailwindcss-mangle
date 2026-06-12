import fs from 'node:fs'
import { appCommandPnpmfile, createAppCommandEnv } from './apps.e2e.shared'

describe('apps e2e command environment', () => {
  it('overrides inherited pnpmfile config with an existing noop file', () => {
    const env = createAppCommandEnv()

    expect(env.NPM_CONFIG_PNPMFILE).toBe(appCommandPnpmfile)
    expect(env.npm_config_pnpmfile).toBe(appCommandPnpmfile)
    expect(fs.existsSync(appCommandPnpmfile)).toBe(true)
  })

  it('keeps app-specific environment overrides', () => {
    const env = createAppCommandEnv({
      NODE_ENV: 'production',
      CUSTOM_APP_FLAG: '1',
    })

    expect(env.NODE_ENV).toBe('production')
    expect(env.CUSTOM_APP_FLAG).toBe('1')
  })
})

import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig
      // transformIgnorePatterns: ['/node_modules/(?!(@parse5/)/tools)']
    }
  ]
}

export default config

import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig,
      modulePathIgnorePatterns: ['test/html.test.ts']
      // transformIgnorePatterns: ['/node_modules/(?!(@parse5/)/tools)']
    }
  ]
}

export default config

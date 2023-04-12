import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig,
      modulePathIgnorePatterns: ['<rootDir>/test/fixtures']
    }
  ]
}

export default config

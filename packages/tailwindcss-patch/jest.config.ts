import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig,
      modulePathIgnorePatterns: ['<rootDir>/test/fixtures']
    }
  ],
  collectCoverage: true,
  coverageDirectory: '../../coverage/tailwindcss-patch',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/']
}

export default config

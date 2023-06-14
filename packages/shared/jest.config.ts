import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig
      // transformIgnorePatterns: ['/node_modules/(?!(@parse5/)/tools)']
    }
  ],
  collectCoverage: true,
  coverageDirectory: '../../coverage/tailwindcss-mangle-shared',
  coverageProvider: 'v8',
  coveragePathIgnorePatterns: ['/node_modules/', '/test/']
}

export default config

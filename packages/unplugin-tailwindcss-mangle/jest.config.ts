import type { Config } from 'jest'
import baseConfig from '../../jest.config'
const config: Config = {
  projects: [
    {
      ...baseConfig
    }
  ]
}

export default config

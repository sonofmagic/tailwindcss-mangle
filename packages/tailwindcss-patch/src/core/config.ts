import { loadConfig, createDefineConfig } from 'c12'
import { DeepRequired, UserConfig } from '@/types'
import { getDefaultUserConfig } from '@/defaults'

export function getConfig() {
  return loadConfig<DeepRequired<UserConfig>>({
    name: 'tailwindcss-patch',
    defaults: {
      ...getDefaultUserConfig()
    }
  })
}

export const defineConfig = createDefineConfig<UserConfig>()

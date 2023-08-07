import { loadConfig, createDefineConfig } from 'c12'
import { UserConfig } from '@/types'

export function getConfig() {
  return loadConfig<UserConfig>({
    name: 'tailwindcss-patch',
    defaults: {
      output: {
        filename: '.tw-patch/tw-class-list.json'
      },
      postcss: {
        configDir: process.cwd()
      }
    }
  })
}

export const defineConfig = createDefineConfig<UserConfig>()

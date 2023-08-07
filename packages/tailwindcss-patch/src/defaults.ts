import type { PatchOptions, UserConfig, DeepRequired } from './types'

export const defaultOptions: PatchOptions = {
  overwrite: true
}

export function getDefaultUserConfig(): DeepRequired<UserConfig> {
  return {
    output: {
      filename: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      loose: true
    },
    postcss: {
      configDir: process.cwd()
    }
  }
}

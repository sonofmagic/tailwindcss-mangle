import type { PatchOptions, UserConfig, DeepRequired } from './types'

export function getDefaultPatchOptions(): DeepRequired<PatchOptions> {
  return {
    overwrite: true
  }
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

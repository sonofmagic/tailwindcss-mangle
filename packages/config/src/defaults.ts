import type { PatchUserConfig, UserConfig } from './types'

export function getDefaultPatchConfig(): PatchUserConfig {
  return {
    output: {
      filename: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      loose: true
    },
    tailwindcss: {}
  }
}

export function getDefaultUserConfig(): UserConfig {
  return {
    patch: getDefaultPatchConfig()
  }
}

import type { PatchUserConfig, UserConfig } from './types'

export function getPatchConfig(): PatchUserConfig {
  return {
    output: {
      filename: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      loose: true
    },
    tailwindcss: {
      cwd: process.cwd()
    }
  }
}

export function getUserConfig(): UserConfig {
  return {
    patch: getPatchConfig()
  }
}

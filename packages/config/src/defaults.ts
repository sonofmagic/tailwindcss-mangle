import { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'
import type { MangleUserConfig, PatchUserConfig, UserConfig } from './types'

export function getDefaultPatchConfig(): PatchUserConfig {
  return {
    output: {
      filename: '.tw-patch/tw-class-list.json',
      removeUniversalSelector: true,
      loose: true,
    },
    tailwindcss: {},
  }
}

export function getDefaultMangleUserConfig(): MangleUserConfig {
  return {
    mangleClassFilter: defaultMangleClassFilter,
    include: ['**/*.{js,jsx,ts,tsx,svelte,vue}'],
    exclude: ['node_modules/**/*', '**/*.{css,scss,less,sass,postcss,html,htm}'],
    disabled: process.env.NODE_ENV === 'development',
    classListPath: '.tw-patch/tw-class-list.json',
    classMapOutput: {
      enable: false,
      filename: '.tw-patch/tw-map-list.json',
      loose: true,
    },
    preserveFunction: [],
  }
}

export function getDefaultUserConfig(): UserConfig {
  return {
    patch: getDefaultPatchConfig(),
    mangle: getDefaultMangleUserConfig(),
  }
}

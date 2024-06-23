import process from 'node:process'
import { defaultMangleClassFilter } from '@tailwindcss-mangle/shared'
import { CSS_LANGS_RE } from 'is-css-request'
import type { MangleUserConfig, PatchUserConfig, UserConfig } from './types'

const defaultPipelineInclude = ['**/*.{html,js,ts,jsx,tsx,vue,svelte,astro,elm,php,phtml,mdx,md}', CSS_LANGS_RE]

const defaultPipelineExclude = [/[\\/](node_modules|dist|\.temp|\.cache|\.vscode)[\\/]/]

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
    include: defaultPipelineInclude,
    exclude: defaultPipelineExclude,
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
